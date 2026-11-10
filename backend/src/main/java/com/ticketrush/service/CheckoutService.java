package com.ticketrush.service;

import com.ticketrush.model.dto.CheckoutSessionResponse;
import com.ticketrush.model.dto.LockSeatRequest;
import com.ticketrush.model.dto.VoucherResponse;
import com.ticketrush.model.entity.Order;
import com.ticketrush.model.entity.Seat;
import com.ticketrush.model.entity.Ticket;
import com.ticketrush.model.entity.User;
import com.ticketrush.model.entity.Voucher;
import com.ticketrush.repository.OrderRepository;
import com.ticketrush.repository.SeatRepository;
import com.ticketrush.repository.TicketRepository;
import com.ticketrush.repository.UserRepository;
import com.ticketrush.repository.VoucherRepository;
import com.ticketrush.realtime.RealtimePublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CheckoutService {
    private static final int CHECKOUT_TTL_MINUTES = 10;

    @Value("${app.qr.base-url:/media/qr/qr_for_all.png}")
    private String qrBaseUrl;

    private final OrderRepository orderRepository;
    private final SeatRepository seatRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final SeatLockService seatLockService;
    private final RealtimePublisher realtimePublisher;
    private final VirtualQueueService virtualQueueService;
    private final TicketSignatureService ticketSignatureService;
    private final VoucherRepository voucherRepository;

    @Transactional
    public CheckoutSessionResponse createSession(LockSeatRequest request, String userId) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new RuntimeException("No seats selected");
        }

        List<Seat> seats = seatRepository.findAllById(request.getSeatIds());
        if (seats.size() != request.getSeatIds().size()) {
            throw new RuntimeException("Some seats were not found");
        }

        var showtime = seats.get(0).getZone().getShowtime();
        if (!showtime.getId().equals(request.getShowtimeId())) {
            throw new RuntimeException("Seats do not belong to this showtime");
        }

        Integer maxTickets = showtime.getEvent().getMaxTicketsPerOrder();
        int limit = maxTickets != null && maxTickets > 0 ? maxTickets : 4;
        if (seats.size() > limit) {
            throw new RuntimeException("Max tickets per order exceeded");
        }

        for (Seat seat : seats) {
            if (!request.getShowtimeId().equals(seat.getZone().getShowtime().getId())) {
                throw new RuntimeException("Seats must be in the same showtime");
            }
            if ("SOLD".equalsIgnoreCase(seat.getStatus())) {
                throw new RuntimeException("One or more seats are already sold");
            }
        }

        // Dọn dẹp bất kỳ vé nháp nào còn sót lại từ các đơn hàng chưa hoàn tất/đã hủy
        List<Ticket> staleTickets = ticketRepository.findBySeatIdIn(request.getSeatIds());
        for (Ticket staleTicket : staleTickets) {
            if (staleTicket.getOrder() != null && !"COMPLETED".equalsIgnoreCase(staleTicket.getOrder().getStatus())) {
                ticketRepository.delete(staleTicket);
            }
        }
        ticketRepository.flush();

        double total = calculateTotal(seats);
        User user = getOrCreateUser(userId);
        Order order = new Order();
        order.setUser(user);
        order.setStatus("PENDING");
        order.setOriginalPrice(total);
        order.setDiscountAmount(0.0);
        order.setTotalPrice(total);
        order.setExpiresAt(LocalDateTime.now().plusMinutes(CHECKOUT_TTL_MINUTES));
        order = orderRepository.save(order);

        boolean locked = seatLockService.lockSeats(request.getShowtimeId(), request.getSeatIds(), userId, order.getId());
        if (!locked) {
            orderRepository.delete(order);
            throw new RuntimeException("Seats are already locked");
        }

        for (Seat seat : seats) {
            Ticket ticket = new Ticket();
            ticket.setOrder(order);
            ticket.setSeat(seat);
            ticket.setStatus("ACTIVE");
            ticket = ticketRepository.saveAndFlush(ticket);

            String signature = ticketSignatureService.generateSignature(ticket.getId(), seat.getId());
            String payload = ticketSignatureService.buildPayload(ticket.getId(), seat.getId());
            ticket.setQrSignature(signature);
            ticket.setQrPayload(payload);
            ticket.setQrCode(payload);
            ticketRepository.save(ticket);
        }

        return mapSession(orderRepository.findById(order.getId()).orElseThrow());
    }

    @Transactional
    public CheckoutSessionResponse getSession(UUID orderId, String userId) {
        Order order = getUserOrder(orderId, userId);
        return mapSession(order);
    }

    @Transactional
    public CheckoutSessionResponse confirmSession(UUID orderId, String userId) {
        Order order = getUserOrder(orderId, userId);
        if (!"PENDING".equalsIgnoreCase(order.getStatus())) {
            return mapSession(order);
        }
        if (isExpired(order)) {
            expireSession(order, userId);
            throw new RuntimeException("Checkout session expired");
        }

        List<Ticket> tickets = ticketRepository.findByOrderId(orderId);
        List<Seat> seats = tickets.stream().map(Ticket::getSeat).collect(Collectors.toList());
        UUID showtimeId = seats.get(0).getZone().getShowtime().getId();
        List<UUID> seatIds = seats.stream().map(Seat::getId).collect(Collectors.toList());

        if (!seatLockService.ownsAllLocks(showtimeId, seatIds, userId, orderId)) {
            throw new RuntimeException("Seat lock expired");
        }

        for (Seat seat : seats) {
            seat.setStatus("SOLD");
        }
        seatRepository.saveAll(seats);

        order.setStatus("COMPLETED");
        order.setExpiresAt(null);
        orderRepository.save(order);

        if (order.getVoucher() != null) {
            Voucher voucher = order.getVoucher();
            voucher.setUsedQuantity(voucher.getUsedQuantity() != null ? voucher.getUsedQuantity() + 1 : 1);
            voucherRepository.save(voucher);
        }

        seatLockService.unlockSeats(showtimeId, seatIds, userId);
        for (UUID seatId : seatIds) {
            Map<String, String> payload = new HashMap<>();
            payload.put("seatId", seatId.toString());
            payload.put("status", "SOLD");
            realtimePublisher.publish("/topic/events/showtimes/" + showtimeId + "/seats", payload);
        }

        // Giải phóng slot trong virtual queue
        virtualQueueService.releaseSlot(showtimeId, userId);

        return mapSession(order);
    }

    @Transactional
    public void cancelSession(UUID orderId, String userId) {
        Order order = getUserOrder(orderId, userId);
        if (!"PENDING".equalsIgnoreCase(order.getStatus())) {
            return;
        }
        expireSession(order, userId);
    }

    @Transactional
    public CheckoutSessionResponse applyVoucher(UUID orderId, String voucherCode, String userId) {
        Order order = getUserOrder(orderId, userId);
        if (!"PENDING".equalsIgnoreCase(order.getStatus())) {
            throw new RuntimeException("Đơn hàng không ở trạng thái chờ thanh toán");
        }
        if (voucherCode == null || voucherCode.trim().isEmpty()) {
            throw new RuntimeException("Mã giảm giá không được để trống");
        }

        Voucher voucher = voucherRepository.findByCodeIgnoreCaseAndActiveTrue(voucherCode.trim())
                .orElseThrow(() -> new RuntimeException("Mã giảm giá không tồn tại hoặc đã hết hiệu lực"));

        LocalDateTime now = LocalDateTime.now();
        if (voucher.getStartDate() != null && now.isBefore(voucher.getStartDate())) {
            throw new RuntimeException("Mã giảm giá chưa đến thời gian áp dụng");
        }
        if (voucher.getEndDate() != null && now.isAfter(voucher.getEndDate())) {
            throw new RuntimeException("Mã giảm giá đã hết hạn sử dụng");
        }

        if (voucher.getUsedQuantity() != null && voucher.getTotalQuantity() != null
                && voucher.getUsedQuantity() >= voucher.getTotalQuantity()) {
            throw new RuntimeException("Mã giảm giá đã hết lượt sử dụng");
        }

        List<Ticket> tickets = ticketRepository.findByOrderId(order.getId());
        if (tickets.isEmpty()) {
            throw new RuntimeException("Đơn hàng không có ghế nào");
        }

        if (voucher.getEvent() != null) {
            UUID eventId = tickets.get(0).getSeat().getZone().getShowtime().getEvent().getId();
            if (!voucher.getEvent().getId().equals(eventId)) {
                throw new RuntimeException("Mã giảm giá chỉ áp dụng cho sự kiện: " + voucher.getEvent().getEventName());
            }
        }

        double originalPrice = order.getOriginalPrice() != null ? order.getOriginalPrice() : order.getTotalPrice();
        if (voucher.getMinOrderPrice() != null && originalPrice < voucher.getMinOrderPrice()) {
            throw new RuntimeException(String.format("Đơn hàng tối thiểu phải từ %,.0f đ để áp dụng mã này", voucher.getMinOrderPrice()));
        }

        double discount = 0.0;
        if ("PERCENTAGE".equalsIgnoreCase(voucher.getDiscountType())) {
            double rawDiscount = originalPrice * (voucher.getDiscountValue() / 100.0);
            if (voucher.getMaxDiscount() != null && voucher.getMaxDiscount() > 0) {
                discount = Math.min(rawDiscount, voucher.getMaxDiscount());
            } else {
                discount = rawDiscount;
            }
        } else {
            discount = Math.min(voucher.getDiscountValue(), originalPrice);
        }

        double finalPrice = Math.max(0.0, originalPrice - discount);

        order.setVoucher(voucher);
        order.setDiscountAmount(discount);
        order.setTotalPrice(finalPrice);
        orderRepository.save(order);

        return mapSession(order);
    }

    @Transactional
    public CheckoutSessionResponse removeVoucher(UUID orderId, String userId) {
        Order order = getUserOrder(orderId, userId);
        if (!"PENDING".equalsIgnoreCase(order.getStatus())) {
            throw new RuntimeException("Đơn hàng không ở trạng thái chờ thanh toán");
        }

        order.setVoucher(null);
        order.setDiscountAmount(0.0);
        order.setTotalPrice(order.getOriginalPrice() != null ? order.getOriginalPrice() : order.getTotalPrice());
        orderRepository.save(order);

        return mapSession(order);
    }

    public String buildVietQrUrl(UUID orderId, Double amount) {
        long roundAmount = Math.round(amount != null ? amount : 0.0);
        String orderCode = orderId.toString().replace("-", "").substring(0, 8).toUpperCase();
        return String.format("Đây là QR thanh toán giả lập của hệ thống TicketRush.\nMã đơn hàng: ORDER %s\nSố tiền: %,d đ\n(Demo Only - Vui lòng bấm 'Xác nhận đã chuyển' trên màn hình)",
                orderCode, roundAmount);
    }

    @Transactional(readOnly = true)
    public List<VoucherResponse> getActiveVouchers() {
        return voucherRepository.findByActiveTrueOrderByMinOrderPriceAsc().stream().map(v -> {
            VoucherResponse res = new VoucherResponse();
            res.setId(v.getId());
            res.setCode(v.getCode());
            res.setDescription(v.getDescription());
            res.setDiscountType(v.getDiscountType());
            res.setDiscountValue(v.getDiscountValue());
            res.setMaxDiscount(v.getMaxDiscount());
            res.setMinOrderPrice(v.getMinOrderPrice());
            res.setTotalQuantity(v.getTotalQuantity());
            res.setUsedQuantity(v.getUsedQuantity());
            res.setStartDate(v.getStartDate());
            res.setEndDate(v.getEndDate());
            res.setActive(v.getActive());
            if (v.getEvent() != null) {
                res.setEventId(v.getEvent().getId());
                res.setEventName(v.getEvent().getEventName());
            }
            return res;
        }).collect(Collectors.toList());
    }

    private void expireSession(Order order, String userId) {
        List<Ticket> tickets = ticketRepository.findByOrderId(order.getId());
        UUID showtimeId = null;
        if (!tickets.isEmpty()) {
            showtimeId = tickets.get(0).getSeat().getZone().getShowtime().getId();
            List<UUID> seatIds = tickets.stream().map(ticket -> ticket.getSeat().getId()).collect(Collectors.toList());
            seatLockService.unlockSeats(showtimeId, seatIds, userId);
            ticketRepository.deleteAll(tickets);
            ticketRepository.flush();
        }
        order.setStatus("EXPIRED");
        orderRepository.save(order);

        // Giải phóng slot trong virtual queue
        if (showtimeId != null) {
            virtualQueueService.releaseSlot(showtimeId, userId);
        }
    }

    private Order getUserOrder(UUID orderId, String userId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Checkout session not found"));
        if (!order.getUser().getId().equals(UUID.fromString(userId))) {
            throw new RuntimeException("Checkout session does not belong to current user");
        }
        if ("PENDING".equalsIgnoreCase(order.getStatus()) && isExpired(order)) {
            expireSession(order, userId);
        }
        return order;
    }

    private boolean isExpired(Order order) {
        return order.getExpiresAt() != null && order.getExpiresAt().isBefore(LocalDateTime.now());
    }

    private User getOrCreateUser(String userId) {
        return userRepository.findById(UUID.fromString(userId))
                .orElseGet(() -> {
                    User user = new User();
                    user.setId(UUID.fromString(userId));
                    user.setEmail("user-" + userId + "@example.com");
                    user.setRole("USER");
                    return userRepository.save(user);
                });
    }

    private double calculateTotal(List<Seat> seats) {
        return seats.stream()
                .mapToDouble(seat -> seat.getZone() != null && seat.getZone().getPrice() != null ? seat.getZone().getPrice() : 0.0)
                .sum();
    }

    private CheckoutSessionResponse mapSession(Order order) {
        List<Ticket> tickets = ticketRepository.findByOrderId(order.getId());
        if (tickets.isEmpty()) {
            throw new RuntimeException("Checkout session has no seats");
        }

        Seat firstSeat = tickets.get(0).getSeat();
        var showtime = firstSeat.getZone().getShowtime();
        var event = showtime.getEvent();

        CheckoutSessionResponse response = new CheckoutSessionResponse();
        response.setOrderId(order.getId());
        response.setShowtimeId(showtime.getId());
        response.setStatus(order.getStatus());
        response.setTotalPrice(order.getTotalPrice());
        response.setOriginalPrice(order.getOriginalPrice() != null ? order.getOriginalPrice() : order.getTotalPrice());
        response.setDiscountAmount(order.getDiscountAmount() != null ? order.getDiscountAmount() : 0.0);
        if (order.getVoucher() != null) {
            response.setVoucherCode(order.getVoucher().getCode());
            response.setVoucherDescription(order.getVoucher().getDescription());
        }
        response.setQrCodeUrl(buildVietQrUrl(order.getId(), order.getTotalPrice()));
        response.setCreatedAt(order.getCreatedAt());
        response.setExpiresAt(order.getExpiresAt());

        CheckoutSessionResponse.EventSummary eventSummary = new CheckoutSessionResponse.EventSummary();
        eventSummary.setId(event.getId());
        eventSummary.setEventName(event.getEventName());
        eventSummary.setCoverImage(event.getCoverImage());
        eventSummary.setVenueName(event.getVenueName());
        eventSummary.setVenueAddress(event.getVenueAddress());
        response.setEvent(eventSummary);

        CheckoutSessionResponse.ShowtimeSummary showtimeSummary = new CheckoutSessionResponse.ShowtimeSummary();
        showtimeSummary.setId(showtime.getId());
        showtimeSummary.setName(showtime.getName());
        showtimeSummary.setStartTime(showtime.getStartTime());
        showtimeSummary.setEndTime(showtime.getEndTime());
        response.setShowtime(showtimeSummary);

        response.setSelectedSeats(tickets.stream().map(ticket -> {
            Seat seat = ticket.getSeat();
            CheckoutSessionResponse.SeatSummary seatSummary = new CheckoutSessionResponse.SeatSummary();
            seatSummary.setId(seat.getId());
            seatSummary.setLabel(seat.getSeatLabel());
            seatSummary.setSeatLabel(seat.getSeatLabel());
            seatSummary.setZoneName(seat.getZone().getName());
            seatSummary.setPrice(seat.getZone().getPrice());
            seatSummary.setRow(seat.getGridRow());
            seatSummary.setCol(seat.getGridCol());
            seatSummary.setGridRow(seat.getGridRow());
            seatSummary.setGridCol(seat.getGridCol());
            return seatSummary;
        }).collect(Collectors.toList()));

        return response;
    }
}

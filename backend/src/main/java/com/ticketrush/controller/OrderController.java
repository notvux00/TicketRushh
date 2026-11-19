package com.ticketrush.controller;

import com.ticketrush.model.entity.Order;
import com.ticketrush.model.entity.Ticket;
import com.ticketrush.model.dto.ApplyVoucherRequest;
import com.ticketrush.model.dto.CheckoutSessionResponse;
import com.ticketrush.model.dto.VoucherResponse;
import com.ticketrush.model.dto.LockSeatRequest;
import com.ticketrush.repository.OrderRepository;
import com.ticketrush.repository.TicketRepository;
import com.ticketrush.service.CheckoutService;
import com.ticketrush.service.TicketSignatureService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private CheckoutService checkoutService;

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketSignatureService ticketSignatureService;

    @PostMapping("/checkout")
    public CheckoutSessionResponse createCheckout(@Valid @RequestBody LockSeatRequest request, Authentication authentication) {
        return checkoutService.createSession(request, authentication.getName());
    }

    @GetMapping("/checkout/{orderId}")
    public CheckoutSessionResponse getCheckout(@PathVariable UUID orderId, Authentication authentication) {
        return checkoutService.getSession(orderId, authentication.getName());
    }

    @PostMapping("/checkout/{orderId}/confirm")
    public CheckoutSessionResponse confirmCheckout(@PathVariable UUID orderId, Authentication authentication) {
        return checkoutService.confirmSession(orderId, authentication.getName());
    }

    @PostMapping("/checkout/{orderId}/cancel")
    public ResponseEntity<Void> cancelCheckout(@PathVariable UUID orderId, Authentication authentication) {
        checkoutService.cancelSession(orderId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/checkout/{orderId}/apply-voucher")
    public CheckoutSessionResponse applyVoucher(@PathVariable UUID orderId,
                                                @Valid @RequestBody ApplyVoucherRequest request,
                                                Authentication authentication) {
        return checkoutService.applyVoucher(orderId, request.getCode(), authentication.getName());
    }

    @PostMapping("/checkout/{orderId}/remove-voucher")
    public CheckoutSessionResponse removeVoucher(@PathVariable UUID orderId, Authentication authentication) {
        return checkoutService.removeVoucher(orderId, authentication.getName());
    }

    @GetMapping("/vouchers")
    public List<VoucherResponse> getActiveVouchers() {
        return checkoutService.getActiveVouchers();
    }

    @GetMapping("/my-tickets")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMyTickets(Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        List<Order> orders = orderRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, "COMPLETED");
        
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (Order order : orders) {
            Map<String, Object> orderMap = new HashMap<>();
            orderMap.put("id", order.getId().toString());
            orderMap.put("totalPrice", order.getTotalPrice());
            orderMap.put("createdAt", order.getCreatedAt());
            
            List<Map<String, Object>> ticketList = new ArrayList<>();
            if (order.getTickets() != null && !order.getTickets().isEmpty()) {
                // Lấy thông tin Event từ vé đầu tiên
                Ticket firstTicket = order.getTickets().get(0);
                var seat = firstTicket.getSeat();
                var zone = seat.getZone();
                var showtime = zone.getShowtime();
                var event = showtime.getEvent();
                
                orderMap.put("eventName", event.getEventName());
                orderMap.put("eventImage", event.getCoverImage());
                orderMap.put("venueName", event.getVenueName());
                orderMap.put("startTime", com.ticketrush.util.EventTime.toOffset(showtime.getStartTime()));
                
                for (Ticket ticket : order.getTickets()) {
                    Map<String, Object> t = new HashMap<>();
                    t.put("id", ticket.getId().toString());
                    t.put("ticketId", ticket.getId().toString());
                    t.put("seatId", ticket.getSeat().getId().toString());
                    t.put("seatLabel", ticket.getSeat().getSeatLabel());
                    t.put("zoneName", ticket.getSeat().getZone().getName());
                    t.put("price", ticket.getUnitPrice());
                    String qr = ticket.getQrPayload() != null ? ticket.getQrPayload() : ticket.getQrCode();
                    t.put("qrCode", qr);
                    t.put("qrPayload", qr);
                    t.put("status", ticket.getStatus() != null ? ticket.getStatus() : "ACTIVE");
                    t.put("checkedInAt", ticket.getCheckedInAt());
                    ticketList.add(t);
                }
            }
            orderMap.put("tickets", ticketList);
            result.add(orderMap);
        }
        
        return result;
    }

    @GetMapping("/my-tickets/{ticketId}/qr")
    @Transactional(readOnly = true)
    public Map<String, Object> getRotatingTicketQr(@PathVariable UUID ticketId, Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy vé"));

        boolean owned = ticket.getOrder() != null
                && ticket.getOrder().getUser() != null
                && userId.equals(ticket.getOrder().getUser().getId())
                && "COMPLETED".equalsIgnoreCase(ticket.getOrder().getStatus());
        if (!owned || !"ACTIVE".equalsIgnoreCase(ticket.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy vé");
        }

        long window = ticketSignatureService.rotatingWindow();
        String payload = ticketSignatureService.buildRotatingPayload(ticketId, ticket.getSeat().getId(), window);
        return Map.of(
                "payload", payload,
                "expiresAt", (window + 1) * 60_000L,
                "window", window);
    }
}

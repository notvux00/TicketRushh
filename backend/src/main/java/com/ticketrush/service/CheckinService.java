package com.ticketrush.service;

import com.ticketrush.model.dto.CheckinRequest;
import com.ticketrush.model.dto.CheckinResponse;
import com.ticketrush.model.entity.Ticket;
import com.ticketrush.model.entity.TicketCheckin;
import com.ticketrush.repository.TicketCheckinRepository;
import com.ticketrush.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class CheckinService {

    private final TicketRepository ticketRepository;
    private final TicketCheckinRepository ticketCheckinRepository;
    private final TicketSignatureService ticketSignatureService;

    @Transactional
    public CheckinResponse scanAndCheckIn(CheckinRequest request, String staffEmail) {
        String gate = (request.getGateName() != null && !request.getGateName().isBlank())
                ? request.getGateName()
                : "Main Gate";

        var parsed = ticketSignatureService.parseAndVerify(request.getQrPayload());
        if (!parsed.validFormat()) {
            return CheckinResponse.builder()
                    .success(false)
                    .status("INVALID_SIGNATURE")
                    .message("Mã QR không hợp lệ hoặc chữ ký điện tử bị sai lệch!")
                    .build();
        }

        Ticket ticket = ticketRepository.findById(parsed.ticketId()).orElse(null);
        if (ticket == null) {
            return CheckinResponse.builder()
                    .success(false)
                    .status("TICKET_NOT_FOUND")
                    .message("Không tìm thấy thông tin vé trong hệ thống!")
                    .build();
        }

        // Kiểm tra xem vé có đúng seatId được ký không
        if (!ticket.getSeat().getId().equals(parsed.seatId())) {
            recordCheckin(ticket, gate, request.getDeviceId(), staffEmail, "SEAT_MISMATCH");
            return CheckinResponse.builder()
                    .success(false)
                    .status("INVALID_SIGNATURE")
                    .message("Mã QR không khớp với vị trí ghế đã đăng ký!")
                    .build();
        }

        // Kiểm tra xem vé đã được check-in trước đó chưa
        if ("CHECKED_IN".equalsIgnoreCase(ticket.getStatus())) {
            recordCheckin(ticket, gate, request.getDeviceId(), staffEmail, "ALREADY_CHECKED_IN");
            return CheckinResponse.builder()
                    .success(false)
                    .status("ALREADY_CHECKED_IN")
                    .message("Vé này đã được quét vào cửa lúc " + ticket.getCheckedInAt() + " bởi " + ticket.getCheckedInBy())
                    .checkedInAt(ticket.getCheckedInAt())
                    .ticketInfo(buildTicketInfo(ticket))
                    .build();
        }

        // Kiểm tra trạng thái hợp lệ
        if (!"ACTIVE".equalsIgnoreCase(ticket.getStatus())) {
            recordCheckin(ticket, gate, request.getDeviceId(), staffEmail, "TICKET_INACTIVE");
            return CheckinResponse.builder()
                    .success(false)
                    .status("TICKET_INACTIVE")
                    .message("Vé này không ở trạng thái hoạt động (Trạng thái: " + ticket.getStatus() + ")")
                    .build();
        }

        // Cập nhật trạng thái CHECKED_IN
        LocalDateTime now = LocalDateTime.now();
        ticket.setStatus("CHECKED_IN");
        ticket.setCheckedInAt(now);
        ticket.setCheckedInBy(staffEmail != null ? staffEmail : "Gate Scanner");
        ticketRepository.save(ticket);

        // Ghi nhật ký soát vé thành công
        recordCheckin(ticket, gate, request.getDeviceId(), staffEmail, "SUCCESS");

        log.info("Ticket {} (Seat {}) checked in successfully at {}", ticket.getId(), ticket.getSeat().getSeatLabel(), gate);

        return CheckinResponse.builder()
                .success(true)
                .status("CHECKED_IN")
                .message("Quét vé thành công. Mời quý khách vào cửa!")
                .checkedInAt(now)
                .ticketInfo(buildTicketInfo(ticket))
                .build();
    }

    private void recordCheckin(Ticket ticket, String gate, String deviceId, String staffEmail, String result) {
        TicketCheckin checkin = TicketCheckin.builder()
                .ticket(ticket)
                .scannedAt(LocalDateTime.now())
                .gateName(gate)
                .deviceId(deviceId)
                .staffEmail(staffEmail)
                .result(result)
                .build();
        ticketCheckinRepository.save(checkin);
    }

    private CheckinResponse.TicketInfo buildTicketInfo(Ticket ticket) {
        var seat = ticket.getSeat();
        var zone = seat.getZone();
        var showtime = zone.getShowtime();
        var event = showtime.getEvent();
        var user = ticket.getOrder().getUser();

        return CheckinResponse.TicketInfo.builder()
                .ticketId(ticket.getId())
                .eventName(event.getEventName())
                .venueName(event.getVenueName())
                .zoneName(zone.getName())
                .seatLabel(seat.getSeatLabel())
                .customerName(user != null ? user.getFullName() : "Khách hàng")
                .build();
    }
}


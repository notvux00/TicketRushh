package com.ticketrush.controller;

import com.ticketrush.model.dto.EventResponse;
import com.ticketrush.model.dto.LockSeatRequest;
import com.ticketrush.model.dto.LockSeatResponse;
import com.ticketrush.model.dto.SeatResponse;
import com.ticketrush.model.dto.ShowtimeSeatResponse;
import com.ticketrush.model.dto.ZoneResponse;
import com.ticketrush.service.CheckoutService;
import com.ticketrush.service.EventService;
import com.ticketrush.service.SeatLockService;
import com.ticketrush.service.SeatService;
import com.ticketrush.service.VirtualQueueService;
import com.ticketrush.service.ZoneService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final ZoneService zoneService;
    private final SeatService seatService;
    private final SeatLockService seatLockService;
    private final VirtualQueueService virtualQueueService;
    private final CheckoutService checkoutService;

    @GetMapping
    public List<EventResponse> getEvents() {
        return eventService.getAllEvents();
    }

    @GetMapping("/{id}")
    public EventResponse getEventById(@PathVariable UUID id) {
        return eventService.getEventById(id);
    }

    @GetMapping("/showtimes/{showtimeId}/zones")
    public List<ZoneResponse> getZonesByShowtime(@PathVariable UUID showtimeId) {
        return zoneService.getZonesByShowtime(showtimeId);
    }

    @GetMapping("/zones/{zoneId}/seats")
    public List<SeatResponse> getSeatsByZone(
            @PathVariable UUID zoneId,
            Authentication authentication) {
        String userId = (authentication != null && authentication.isAuthenticated()) ? authentication.getName() : null;
        return seatService.getSeatsByZoneForBooking(zoneId, userId);
    }

    @GetMapping("/showtimes/{showtimeId}/seats")
    public List<ShowtimeSeatResponse> getSeatsByShowtime(
            @PathVariable UUID showtimeId,
            Authentication authentication) {
        String userId = (authentication != null && authentication.isAuthenticated()) ? authentication.getName() : null;
        return seatService.getSeatsByShowtimeForBooking(showtimeId, userId);
    }

    @PostMapping("/seats/lock")
    public LockSeatResponse lockSeats(
            @Valid @RequestBody LockSeatRequest request,
            Authentication authentication) {

        String userId = authentication.getName();

        // Queue guard: kiểm tra thẻ vào cửa nếu queue đang hoạt động
        if (!virtualQueueService.canBook(request.getShowtimeId(), userId)) {
            return new LockSeatResponse(false, "QUEUE_ACCESS_REQUIRED", null);
        }

        boolean success = seatLockService.lockSeats(request.getShowtimeId(), request.getSeatIds(), userId);
        if (success) {
            // Expires in 10 minutes
            Instant expiresAt = Instant.now().plusSeconds(600);
            return new LockSeatResponse(true, "Seats locked successfully", expiresAt);
        }
        return new LockSeatResponse(false, "Seats are already locked or max limit exceeded", null);
    }

    @PostMapping("/seats/unlock")
    public LockSeatResponse unlockSeats(
            @Valid @RequestBody LockSeatRequest request,
            Authentication authentication) {
        seatLockService.unlockSeats(request.getShowtimeId(), request.getSeatIds(), authentication.getName());
        return new LockSeatResponse(true, "Seats unlocked", null);
    }

    @PostMapping("/seats/confirm")
    public LockSeatResponse confirmSeats(
            @Valid @RequestBody LockSeatRequest request,
            Authentication authentication) {
        var session = checkoutService.createAndConfirmSession(request, authentication.getName());
        return new LockSeatResponse(
                "COMPLETED".equals(session.getStatus()), "Booking confirmed", null, session.getOrderId());
    }
}

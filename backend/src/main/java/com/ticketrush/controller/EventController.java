package com.ticketrush.controller;

import com.ticketrush.model.dto.EventResponse;
import com.ticketrush.model.dto.ZoneResponse;
import com.ticketrush.model.dto.SeatResponse;
import com.ticketrush.service.EventService;
import com.ticketrush.service.ZoneService;
import com.ticketrush.service.SeatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "http://localhost:5173") // Cho phép Frontend truy cập
public class EventController {

    @Autowired
    private EventService eventService;

    @Autowired
    private ZoneService zoneService;

    @Autowired
    private SeatService seatService;

    @GetMapping
    public List<EventResponse> getEvents() {
        return eventService.getAllEvents();
    }

    @GetMapping("/{id}")
    public EventResponse getEventById(@PathVariable UUID id) {
        return eventService.getEventById(id);
    }

    // New Public Endpoints
    @GetMapping("/showtimes/{showtimeId}/zones")
    public List<ZoneResponse> getZonesByShowtime(@PathVariable UUID showtimeId) {
        return zoneService.getZonesByShowtime(showtimeId);
    }

    @GetMapping("/zones/{zoneId}/seats")
    public List<SeatResponse> getSeatsByZone(
            @PathVariable UUID zoneId,
            org.springframework.security.core.Authentication authentication) {
        String userId = (authentication != null && authentication.isAuthenticated()) ? authentication.getName() : null;
        return seatService.getSeatsByZoneForBooking(zoneId, userId);
    }

    @Autowired
    private com.ticketrush.service.SeatLockService seatLockService;

    @Autowired
    private com.ticketrush.service.VirtualQueueService virtualQueueService;

    @PostMapping("/seats/lock")
    public com.ticketrush.model.dto.LockSeatResponse lockSeats(
            @RequestBody com.ticketrush.model.dto.LockSeatRequest request,
            org.springframework.security.core.Authentication authentication) {
        
        // Use user email or ID from JWT as locker identity
        String userId = authentication.getName(); 
        
        // Queue guard: kiểm tra thẻ vào cửa nếu queue đang hoạt động
        int activeCount = virtualQueueService.getActiveCount(request.getShowtimeId());
        int threshold = virtualQueueService.getThreshold(request.getShowtimeId());
        if (activeCount >= threshold && !virtualQueueService.hasValidPass(request.getShowtimeId(), userId)) {
            return new com.ticketrush.model.dto.LockSeatResponse(false, "QUEUE_ACCESS_REQUIRED", null);
        }

        boolean success = seatLockService.lockSeats(request.getShowtimeId(), request.getSeatIds(), userId);
        if (success) {
            // Expires in 10 minutes
            java.time.Instant expiresAt = java.time.Instant.now().plusSeconds(600);
            return new com.ticketrush.model.dto.LockSeatResponse(true, "Seats locked successfully", expiresAt);
        } else {
            return new com.ticketrush.model.dto.LockSeatResponse(false, "Seats are already locked or max limit exceeded", null);
        }
    }

    @PostMapping("/seats/unlock")
    public com.ticketrush.model.dto.LockSeatResponse unlockSeats(
            @RequestBody com.ticketrush.model.dto.LockSeatRequest request,
            org.springframework.security.core.Authentication authentication) {
        
        String userId = authentication.getName();
        seatLockService.unlockSeats(request.getShowtimeId(), request.getSeatIds(), userId);
        
        return new com.ticketrush.model.dto.LockSeatResponse(true, "Seats unlocked", null);
    }

    @PostMapping("/seats/confirm")
    public com.ticketrush.model.dto.LockSeatResponse confirmSeats(
            @RequestBody com.ticketrush.model.dto.LockSeatRequest request,
            org.springframework.security.core.Authentication authentication) {
        
        String userId = authentication.getName();
        boolean success = seatLockService.confirmSeats(request.getShowtimeId(), request.getSeatIds(), userId);
        
        if (success) {
            return new com.ticketrush.model.dto.LockSeatResponse(true, "Payment confirmed and seats sold", null);
        } else {
            return new com.ticketrush.model.dto.LockSeatResponse(false, "Failed to confirm payment. Lock may have expired.", null);
        }
    }
}
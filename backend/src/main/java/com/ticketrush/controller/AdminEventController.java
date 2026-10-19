package com.ticketrush.controller;

import com.ticketrush.model.dto.EventCreateRequest;
import com.ticketrush.model.dto.EventAnalyticsResponse;
import com.ticketrush.model.dto.EventResponse;
import com.ticketrush.model.dto.EventUpdateRequest;
import com.ticketrush.model.dto.ZonePositionUpdate;
import com.ticketrush.service.EventAnalyticsService;
import com.ticketrush.service.EventService;
import com.ticketrush.service.ZoneService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/events")
@RequiredArgsConstructor
public class AdminEventController {

    private final EventService eventService;
    private final ZoneService zoneService;
    private final EventAnalyticsService eventAnalyticsService;

    @PostMapping
    public ResponseEntity<EventResponse> createEvent(@RequestBody EventCreateRequest request) {
        EventResponse response = eventService.createEvent(request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{eventId}")
    public ResponseEntity<EventResponse> updateEvent(
            @PathVariable UUID eventId,
            @RequestBody EventUpdateRequest request) {
        return ResponseEntity.ok(eventService.updateEvent(eventId, request));
    }

    @PutMapping("/{eventId}")
    public ResponseEntity<EventResponse> replaceEvent(
            @PathVariable UUID eventId,
            @RequestBody EventUpdateRequest request) {
        return ResponseEntity.ok(eventService.updateEvent(eventId, request));
    }

    @GetMapping("/{eventId}/analytics")
    public ResponseEntity<EventAnalyticsResponse> getEventAnalytics(@PathVariable UUID eventId) {
        return ResponseEntity.ok(eventAnalyticsService.getEventAnalytics(eventId));
    }

    @GetMapping("/showtimes/{showtimeId}/analytics")
    public ResponseEntity<EventAnalyticsResponse> getShowtimeAnalytics(@PathVariable UUID showtimeId) {
        return ResponseEntity.ok(eventAnalyticsService.getShowtimeAnalytics(showtimeId));
    }

    @PatchMapping("/{eventId}/zones/positions")
    public ResponseEntity<String> updateEventZonePositions(
            @PathVariable UUID eventId,
            @RequestBody List<ZonePositionUpdate> updates) {
        zoneService.updatePositionsByEvent(eventId, updates);
        return ResponseEntity.ok("Đã đồng bộ tọa độ cho toàn bộ các suất diễn!");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable UUID id) {
        eventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }
}

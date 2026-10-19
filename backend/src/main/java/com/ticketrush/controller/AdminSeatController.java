package com.ticketrush.controller;

import com.ticketrush.model.dto.SeatBulkUpdateRequest;
import com.ticketrush.model.dto.SeatResponse;
import com.ticketrush.service.SeatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/zones/{zoneId}/seats")
@RequiredArgsConstructor
public class AdminSeatController {
    private final SeatService seatService;

    @GetMapping
    public ResponseEntity<List<SeatResponse>> getSeats(@PathVariable UUID zoneId) {
        return ResponseEntity.ok(seatService.getSeatsByZone(zoneId, null));
    }

    @PatchMapping("/bulk-status")
    public ResponseEntity<Void> updateBulkStatus(@RequestBody SeatBulkUpdateRequest request) {
        seatService.updateSeatsStatus(request);
        return ResponseEntity.ok().build();
    }
}

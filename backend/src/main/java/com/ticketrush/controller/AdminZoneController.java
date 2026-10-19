package com.ticketrush.controller;
import com.ticketrush.model.dto.ZonePositionUpdate;
import com.ticketrush.model.dto.ZoneRequest;
import com.ticketrush.model.dto.ZoneResponse;
import com.ticketrush.service.ZoneService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/showtimes/{showtimeId}/zones")
@RequiredArgsConstructor
public class AdminZoneController {
    private final ZoneService zoneService;

    @GetMapping
    public ResponseEntity<List<ZoneResponse>> getZones(@PathVariable UUID showtimeId) {
        return ResponseEntity.ok(zoneService.getZonesByShowtime(showtimeId));
    }

    @PostMapping
    public ResponseEntity<String> createZone(
            @PathVariable UUID showtimeId, 
            @RequestBody ZoneRequest request) {
        zoneService.createZone(showtimeId, request);
        return ResponseEntity.ok("Khởi tạo khu vực và danh sách ghế thành công!");
    }

    @DeleteMapping("/{zoneId}")
    public ResponseEntity<String> deleteZone(@PathVariable UUID zoneId) {
        zoneService.deleteZone(zoneId);
        return ResponseEntity.ok("Đã xóa khu vực thành công!");
    }

    @PatchMapping("/{zoneId}/position")
    public ResponseEntity<Void> updatePosition(
            @PathVariable UUID zoneId,
            @RequestParam Integer x,
            @RequestParam Integer y) {
        zoneService.updateZonePosition(zoneId, x, y);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/api/admin/events/{eventId}/zones/positions")
    public ResponseEntity<String> updateEventZonePositions(
            @PathVariable UUID eventId,
            @RequestBody List<ZonePositionUpdate> updates) {
        zoneService.updatePositionsByEvent(eventId, updates);
        return ResponseEntity.ok("Đã đồng bộ tọa độ cho toàn bộ các suất diễn!");
    }
}

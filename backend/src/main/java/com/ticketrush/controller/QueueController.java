package com.ticketrush.controller;

import com.ticketrush.model.dto.QueueStatusResponse;
import com.ticketrush.service.VirtualQueueService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/queue")
@Validated
@RequiredArgsConstructor
public class QueueController {

    private final VirtualQueueService virtualQueueService;

    // ═══════════════════════════════════════════
    // User Endpoints
    // ═══════════════════════════════════════════

    /**
     * Joins the queue once. Kept separate from status polling so a GET never
     * re-enqueues a user who has already left.
     */
    @PostMapping("/{showtimeId}/join")
    public QueueStatusResponse joinQueue(
            @PathVariable UUID showtimeId,
            Authentication authentication) {
        return virtualQueueService.checkAndEnqueue(showtimeId, authentication.getName());
    }

    @GetMapping("/{showtimeId}/status")
    public QueueStatusResponse getQueueStatus(
            @PathVariable UUID showtimeId,
            Authentication authentication) {
        return virtualQueueService.getStatus(showtimeId, authentication.getName());
    }

    @PostMapping("/{showtimeId}/leave")
    public Map<String, Object> leaveQueue(
            @PathVariable UUID showtimeId,
            Authentication authentication) {
        String userId = authentication.getName();
        virtualQueueService.leaveQueue(showtimeId, userId);
        return Map.of("success", true, "message", "Đã rời hàng chờ");
    }

    // ═══════════════════════════════════════════
    // Admin Endpoints (Demo Mode)
    // ═══════════════════════════════════════════

    @PostMapping("/admin/set-threshold")
    public ResponseEntity<?> setThreshold(
            @RequestParam UUID showtimeId,
            @RequestParam @Min(0) @Max(1_000_000) int threshold) {
        virtualQueueService.setThreshold(showtimeId, threshold);
        return ResponseEntity.ok(Map.of("message", "Threshold updated", "threshold", threshold));
    }

    @PostMapping("/admin/set-batch-size")
    public ResponseEntity<?> setBatchSize(
            @RequestParam UUID showtimeId,
            @RequestParam @Min(1) @Max(100_000) int batchSize) {
        virtualQueueService.setBatchSize(showtimeId, batchSize);
        return ResponseEntity.ok(Map.of("message", "Batch size updated", "batchSize", batchSize));
    }

    @PostMapping("/admin/simulate-users")
    public Map<String, Object> simulateUsers(
            @RequestParam UUID showtimeId,
            @RequestParam @Min(1) @Max(100_000) int count) {
        int created = virtualQueueService.simulateUsers(showtimeId, count);
        return Map.of("success", true, "simulatedCount", created,
                "message", "Đã thêm " + created + " người giả lập vào hàng chờ");
    }

    @PostMapping("/admin/reset")
    public Map<String, Object> resetQueue(@RequestParam UUID showtimeId) {
        virtualQueueService.resetQueue(showtimeId);
        return Map.of("success", true, "message", "Đã reset toàn bộ hàng chờ");
    }

    @GetMapping("/admin/info")
    public Map<String, Object> getQueueInfo(@RequestParam UUID showtimeId) {
        return Map.of(
                "activeUsers", virtualQueueService.getActiveCount(showtimeId),
                "threshold", virtualQueueService.getThreshold(showtimeId),
                "batchSize", virtualQueueService.getBatchSize(showtimeId),
                "showtimeId", showtimeId.toString()
        );
    }
}

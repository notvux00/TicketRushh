package com.ticketrush.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
@AllArgsConstructor
public class LockSeatResponse {
    private boolean success;
    private String message;
    private Instant expiresAt;
    private UUID orderId;

    public LockSeatResponse(boolean success, String message, Instant expiresAt) {
        this.success = success;
        this.message = message;
        this.expiresAt = expiresAt;
    }
}

package com.ticketrush.model.dto;

public record PresignResponse(
        String uploadUrl,
        String publicUrl,
        String key,
        long expiresInSeconds) {
}

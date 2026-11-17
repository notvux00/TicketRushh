package com.ticketrush.model.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.ticketrush.util.EventDateTimeDeserializer;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.UUID;

public record CreateVoucherRequest(
        @NotBlank @Pattern(regexp = "^[A-Z0-9]{4,20}$") String code,
        @NotBlank String discountType,
        @NotNull @Positive Double discountValue,
        @Size(max = 255) String description,
        @Positive Double maxDiscount,
        @PositiveOrZero Double minOrderPrice,
        @JsonDeserialize(using = EventDateTimeDeserializer.class) LocalDateTime expiresAt,
        @Min(1) Integer maxUsage,
        UUID eventId) {}

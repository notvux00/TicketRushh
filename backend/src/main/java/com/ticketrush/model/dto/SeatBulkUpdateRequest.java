package com.ticketrush.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SeatBulkUpdateRequest {

    @NotEmpty(message = "seatIds must not be empty")
    @Size(max = 5000)
    private List<@NotNull(message = "seatId must not be null") UUID> seatIds;

    @NotBlank(message = "status is required")
    @Pattern(regexp = "AVAILABLE|AISLE|SOLD|LOCKED", message = "status không hợp lệ")
    private String status;
}

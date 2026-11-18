package com.ticketrush.model.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class LockSeatRequest {

    @NotNull(message = "showtimeId is required")
    private UUID showtimeId;

    @NotEmpty(message = "seatIds must not be empty")
    @Size(max = 50, message = "at most 50 seats can be locked at once")
    private List<@NotNull(message = "seatId must not be null") UUID> seatIds;
}

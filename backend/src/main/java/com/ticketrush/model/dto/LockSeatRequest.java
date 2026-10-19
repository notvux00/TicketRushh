package com.ticketrush.model.dto;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class LockSeatRequest {
    private UUID showtimeId;
    private List<UUID> seatIds;
}

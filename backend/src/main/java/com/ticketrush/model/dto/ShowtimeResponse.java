package com.ticketrush.model.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ShowtimeResponse {
    private UUID id;
    private String name;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
}

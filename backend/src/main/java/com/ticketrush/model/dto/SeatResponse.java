package com.ticketrush.model.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class SeatResponse {
    private UUID id;
    private String seatLabel;
    private String status; // "AVAILABLE", "LOCKED", "SOLD"
    private Integer gridRow;
    private Integer gridCol;
    private boolean lockedByMe;
}
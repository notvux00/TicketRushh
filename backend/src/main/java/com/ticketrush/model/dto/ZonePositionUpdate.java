package com.ticketrush.model.dto;

import lombok.Data;

@Data
public class ZonePositionUpdate {
    private String zoneName; // Dùng tên để định danh chung cho các suất diễn
    private Integer positionX;
    private Integer positionY;
    
}

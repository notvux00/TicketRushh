package com.ticketrush.model.dto;

import lombok.Data;
import java.util.UUID;

@Data
public class ZoneResponse {
    private UUID id;
    private String name;
    private Integer matrixRow;
    private Integer matrixCol;
    private Integer positionX;
    private Integer positionY;
    private Integer visualWidth;
    private Integer visualHeight;
    private Double price;
}

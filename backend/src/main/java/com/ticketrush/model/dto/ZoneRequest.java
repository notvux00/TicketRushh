package com.ticketrush.model.dto;

import lombok.Data;

@Data
public class ZoneRequest {
    private String name;
    private Integer matrixRow;
    private Integer matrixCol;
    private Double price;
    private Integer positionX = 0;
    private Integer positionY = 0;
    private Integer visualWidth = 160;
    private Integer visualHeight = 120;
}

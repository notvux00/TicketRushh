package com.ticketrush.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ZonePositionUpdate {

    @NotBlank(message = "Tên khu vực không được để trống")
    @Size(max = 255)
    private String zoneName;

    @NotNull(message = "positionX không được để trống")
    private Integer positionX;

    @NotNull(message = "positionY không được để trống")
    private Integer positionY;
}

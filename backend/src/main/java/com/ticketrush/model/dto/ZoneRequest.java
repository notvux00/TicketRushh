package com.ticketrush.model.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ZoneRequest {

    @NotBlank(message = "Tên khu vực không được để trống")
    @Size(max = 255)
    private String name;

    @NotNull(message = "Số hàng không được để trống")
    @Min(value = 1, message = "Số hàng phải >= 1")
    @Max(value = 200, message = "Số hàng tối đa là 200")
    private Integer matrixRow;

    @NotNull(message = "Số cột không được để trống")
    @Min(value = 1, message = "Số cột phải >= 1")
    @Max(value = 200, message = "Số cột tối đa là 200")
    private Integer matrixCol;

    @NotNull(message = "Giá vé không được để trống")
    @DecimalMin(value = "0.0", inclusive = true, message = "Giá vé không được âm")
    @Digits(integer = 12, fraction = 2)
    private Double price;

    @Min(0)
    private Integer positionX = 0;

    @Min(0)
    private Integer positionY = 0;

    @Min(1) @Max(5000)
    private Integer visualWidth = 160;

    @Min(1) @Max(5000)
    private Integer visualHeight = 120;
}

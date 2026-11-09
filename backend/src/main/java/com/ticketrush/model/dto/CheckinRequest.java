package com.ticketrush.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckinRequest {

    @NotBlank(message = "Mã QR không được để trống")
    private String qrPayload;

    private String gateName;
    private String deviceId;
}


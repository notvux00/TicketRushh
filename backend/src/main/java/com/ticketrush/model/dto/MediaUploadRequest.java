package com.ticketrush.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record MediaUploadRequest(
        @NotBlank(message = "fileName is required") String fileName,
        @NotBlank(message = "contentType is required") String contentType,
        @Min(value = 1, message = "size must be greater than zero") long size,
        @NotBlank(message = "kind is required") String kind) {
}

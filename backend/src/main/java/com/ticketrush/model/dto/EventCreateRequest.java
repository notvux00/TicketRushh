package com.ticketrush.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class EventCreateRequest {

    @NotBlank(message = "Tên sự kiện không được để trống")
    @Size(max = 255)
    private String eventName;

    @Size(max = 10000)
    private String description;

    @Size(max = 255)
    private String category;

    @Size(max = 512)
    private String coverImage;

    @Size(max = 512)
    private String trailerUrl;

    @Size(max = 255)
    private String venueName;

    @Size(max = 255)
    private String venueAddress;

    @Min(1) @Max(50)
    private Integer maxTicketsPerOrder;

    @Valid
    @NotEmpty(message = "Cần ít nhất một suất diễn")
    @Size(max = 50)
    private List<ShowtimeRequest> showtimes;

    @Valid
    @Size(max = 50)
    private List<ZoneRequest> zones;

    @Data
    public static class ShowtimeRequest {
        @NotBlank(message = "Tên suất diễn không được để trống")
        @Size(max = 255)
        private String name;

        @NotNull(message = "Giờ bắt đầu không được để trống")
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.ticketrush.util.EventDateTimeDeserializer.class)
        private LocalDateTime startTime;

        @NotNull(message = "Giờ kết thúc không được để trống")
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.ticketrush.util.EventDateTimeDeserializer.class)
        private LocalDateTime endTime;
    }
}

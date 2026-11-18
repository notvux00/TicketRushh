package com.ticketrush.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class EventUpdateRequest {

    @Size(max = 512)
    private String coverImage;

    @Size(max = 10000)
    private String description;

    @Size(max = 255)
    private String venueName;

    @Size(max = 255)
    private String venueAddress;

    @Min(1) @Max(50)
    private Integer maxTicketsPerOrder;

    @Valid
    @Size(max = 50)
    private List<ShowtimeUpdateRequest> showtimes;

    private UUID showtimeIdForZones;

    @Valid
    @Size(max = 50)
    private List<ZoneUpdateRequest> zones;

    @Data
    public static class ShowtimeUpdateRequest {
        private UUID id;

        @Size(max = 255)
        private String name;

        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.ticketrush.util.EventDateTimeDeserializer.class)
        private LocalDateTime startTime;

        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.ticketrush.util.EventDateTimeDeserializer.class)
        private LocalDateTime endTime;
    }

    @Data
    public static class ZoneUpdateRequest {
        private UUID id;

        @Size(max = 255)
        private String name;

        @DecimalMin(value = "0.0", inclusive = true, message = "Giá vé không được âm")
        @Digits(integer = 12, fraction = 2)
        private Double price;
    }
}

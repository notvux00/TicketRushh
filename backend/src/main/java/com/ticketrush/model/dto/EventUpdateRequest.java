package com.ticketrush.model.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class EventUpdateRequest {
    private String coverImage;
    private String description;
    private String venueName;
    private String venueAddress;
    private Integer maxTicketsPerOrder;
    private List<ShowtimeUpdateRequest> showtimes;
    private UUID showtimeIdForZones;
    private List<ZoneUpdateRequest> zones;

    @Data
    public static class ShowtimeUpdateRequest {
        private UUID id;
        private String name;
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.ticketrush.util.EventDateTimeDeserializer.class)
        private LocalDateTime startTime;
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.ticketrush.util.EventDateTimeDeserializer.class)
        private LocalDateTime endTime;
    }

    @Data
    public static class ZoneUpdateRequest {
        private UUID id;
        private String name;
        private Double price;
    }
}

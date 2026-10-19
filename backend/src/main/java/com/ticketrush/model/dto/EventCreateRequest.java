package com.ticketrush.model.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class EventCreateRequest {
    private String eventName;
    private String description;
    private String category;
    private String coverImage;
    private String trailerUrl;
    private String venueName;
    private String venueAddress;
    private Integer maxTicketsPerOrder;
    
    // Danh sách các suất diễn đi kèm
    private List<ShowtimeRequest> showtimes;

    // Danh sách các khu vực (Zones) đi kèm để tạo đồng loạt
    private List<ZoneRequest> zones;

    @Data
    public static class ShowtimeRequest {
        private String name;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
    }
}
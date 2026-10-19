package com.ticketrush.model.dto;

import lombok.Data;
import java.util.List; 
import java.util.UUID;
import java.util.List;

@Data
public class EventResponse {
    private UUID id;
    private String eventName;
    private String description;
    private String category;
    private String coverImage;
    private String trailerUrl;
    private String venueName;
    private String venueAddress;
    private Integer maxTicketsPerOrder;
    
    // THÊM DÒNG NÀY: Để trả về danh sách suất diễn kèm theo
    private List<ShowtimeResponse> showtimes; 
    private Double minPrice; 

    @Data
    public static class ShowtimeResponse {
        private UUID id;
        private String name;
        private java.time.LocalDateTime startTime;
        private java.time.LocalDateTime endTime;
    }
}
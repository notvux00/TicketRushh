package com.ticketrush.model.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class CheckoutSessionResponse {
    private UUID orderId;
    private UUID showtimeId;
    private String status;
    private Double totalPrice;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private EventSummary event;
    private ShowtimeSummary showtime;
    private List<SeatSummary> selectedSeats;

    @Data
    public static class EventSummary {
        private UUID id;
        private String eventName;
        private String coverImage;
        private String venueName;
        private String venueAddress;
    }

    @Data
    public static class ShowtimeSummary {
        private UUID id;
        private String name;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
    }

    @Data
    public static class SeatSummary {
        private UUID id;
        private String label;
        private String seatLabel;
        private String zoneName;
        private Double price;
        private Integer row;
        private Integer col;
        private Integer gridRow;
        private Integer gridCol;
    }
}

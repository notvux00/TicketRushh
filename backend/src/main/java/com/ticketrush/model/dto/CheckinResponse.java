package com.ticketrush.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckinResponse {

    private boolean success;
    private String status;
    private String message;
    private LocalDateTime checkedInAt;
    private TicketInfo ticketInfo;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TicketInfo {
        private UUID ticketId;
        private String eventName;
        private String zoneName;
        private String seatLabel;
        private String customerName;
        private String venueName;
    }
}


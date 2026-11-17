package com.ticketrush.util;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public final class EventTime {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private EventTime() {}

    public static OffsetDateTime toOffset(LocalDateTime value) {
        return value == null ? null : value.atZone(ZONE).toOffsetDateTime();
    }

    public static boolean salesClosed(LocalDateTime startTime) {
        // Preserve support for events whose start time has not been announced.
        return startTime != null && !LocalDateTime.now(ZONE).isBefore(startTime);
    }

    public static void requireSalesOpen(LocalDateTime startTime) {
        if (salesClosed(startTime)) {
            throw new IllegalStateException("Ticket sales have closed for this showtime");
        }
    }
}

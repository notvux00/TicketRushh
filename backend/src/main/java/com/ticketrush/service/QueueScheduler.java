package com.ticketrush.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.UUID;

@Component
public class QueueScheduler {

    private static final Logger log = LoggerFactory.getLogger(QueueScheduler.class);

    @Autowired
    private VirtualQueueService virtualQueueService;

    /**
     * Chạy mỗi 10 giây: quét tất cả showtime đang có hàng chờ,
     * cấp thẻ vào cửa cho batch tiếp theo nếu còn slot.
     */
    @Scheduled(fixedRate = 10000)
    public void processQueues() {
        Set<String> showtimeIds = virtualQueueService.getActiveQueueShowtimeIds();
        if (showtimeIds.isEmpty()) return;

        for (String showtimeIdStr : showtimeIds) {
            try {
                UUID showtimeId = UUID.fromString(showtimeIdStr);
                int granted = virtualQueueService.grantNextBatch(showtimeId);
                if (granted > 0) {
                    log.info("Queue scheduler: granted {} users for showtime {}", granted, showtimeId);
                }
            } catch (IllegalArgumentException e) {
                log.warn("Invalid showtime ID in queue: {}", showtimeIdStr);
            }
        }
    }
}

package com.ticketrush.service;

import com.ticketrush.realtime.RealtimePublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.KeyExpirationEventMessageListener;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Component
@Slf4j
public class RedisKeyExpirationListener extends KeyExpirationEventMessageListener {

    private final RealtimePublisher realtimePublisher;
    private final StringRedisTemplate redisTemplate;
    private final VirtualQueueService queues;

    public RedisKeyExpirationListener(
            RedisMessageListenerContainer listenerContainer,
            RealtimePublisher realtimePublisher,
            StringRedisTemplate redisTemplate, VirtualQueueService queues) {
        super(listenerContainer);
        // ElastiCache forbids CONFIG. Notifications are configured on the server.
        setKeyspaceNotificationsConfigParameter("");
        this.realtimePublisher = realtimePublisher;
        this.redisTemplate = redisTemplate;
        this.queues = queues;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();

        if (expiredKey.startsWith("lock:seat:")) {
            handleSeatLockExpiry(expiredKey);
        }

        if (expiredKey.startsWith("queue:pass:")) {
            handleQueuePassExpiry(expiredKey);
        }
    }

    private void handleSeatLockExpiry(String expiredKey) {
        String[] parts = expiredKey.split(":");
        if (parts.length < 4) {
            return;
        }

        String showtimeId = parts[2];
        String seatId = parts[3];
        String dedupeKey = "expiry:seat:" + showtimeId + ":" + seatId;

        Boolean first = redisTemplate.opsForValue()
                .setIfAbsent(dedupeKey, "1", Duration.ofSeconds(30));
        if (!Boolean.TRUE.equals(first)) {
            return;
        }

        Map<String, String> payload = new HashMap<>();
        payload.put("seatId", seatId);
        payload.put("status", "AVAILABLE");
        realtimePublisher.publish("/topic/events/showtimes/" + showtimeId + "/seats", payload);
        log.debug("Seat lock expired: {}", seatId);
    }

    private void handleQueuePassExpiry(String expiredKey) {
        String[] parts = expiredKey.split(":");
        if (parts.length < 4) {
            return;
        }

        String showtimeId = parts[2];
        // Optional eager refresh only. Counts also reconcile without notifications,
        // and a delayed expiry cannot decrement a replacement pass's count.
        try {
            queues.getActiveCount(java.util.UUID.fromString(showtimeId));
        } catch (IllegalArgumentException invalid) {
            log.debug("Ignoring invalid queue expiry key");
        }
    }
}

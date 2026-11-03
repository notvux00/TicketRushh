package com.ticketrush.service;

import com.ticketrush.realtime.RealtimePublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.listener.KeyExpirationEventMessageListener;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class RedisKeyExpirationListener extends KeyExpirationEventMessageListener {

    /**
     * Decrements the active queue counter exactly once for an expired pass.
     * Every application instance receives the keyspace event, so a dedupe key
     * prevents the counter from being decremented N times.
     */
    private static final DefaultRedisScript<Long> EXPIRE_PASS_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[1]) then
              local current = redis.call('DECR', KEYS[2])
              if current < 0 then
                redis.call('SET', KEYS[2], '0')
              end
              return 1
            end
            return 0
            """, Long.class);

    private final RealtimePublisher realtimePublisher;
    private final StringRedisTemplate redisTemplate;

    public RedisKeyExpirationListener(
            RedisMessageListenerContainer listenerContainer,
            RealtimePublisher realtimePublisher,
            StringRedisTemplate redisTemplate) {
        super(listenerContainer);
        this.realtimePublisher = realtimePublisher;
        this.redisTemplate = redisTemplate;
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
        String userId = parts[3];
        String dedupeKey = "expiry:pass:" + showtimeId + ":" + userId;
        String activeKey = "queue:active:" + showtimeId;

        redisTemplate.execute(
                EXPIRE_PASS_SCRIPT,
                List.of(dedupeKey, activeKey),
                "30");

        log.debug("Queue pass expired for showtime={} user={}", showtimeId, userId);
    }
}

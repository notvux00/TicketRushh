package com.ticketrush.service;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.KeyExpirationEventMessageListener;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class RedisKeyExpirationListener extends KeyExpirationEventMessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    public RedisKeyExpirationListener(
            RedisMessageListenerContainer listenerContainer,
            SimpMessagingTemplate messagingTemplate,
            StringRedisTemplate redisTemplate) {
        super(listenerContainer);
        this.messagingTemplate = messagingTemplate;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();

        // Kiểm tra xem key hết hạn có phải là key khóa ghế không (VD: lock:seat:showtime_id:seat_id)
        if (expiredKey.startsWith("lock:seat:")) {
            // Tách showtimeId và seatId từ key: lock:seat:{showtimeId}:{seatId}
            String[] parts = expiredKey.split(":");
            if (parts.length >= 4) {
                String showtimeId = parts[2];
                String seatId = parts[3];

                // Gửi thông báo WebSocket cho mọi client đang xem showtime này
                Map<String, String> payload = new HashMap<>();
                payload.put("seatId", seatId);
                payload.put("status", "AVAILABLE"); // Ghế đã trống trở lại

                messagingTemplate.convertAndSend("/topic/events/showtimes/" + showtimeId + "/seats", payload);
                System.out.println("Seat lock expired and broadcasted: " + seatId);
            }
        }

        // Xử lý thẻ vào cửa Virtual Queue hết hạn: queue:pass:{showtimeId}:{userId}
        if (expiredKey.startsWith("queue:pass:")) {
            String[] parts = expiredKey.split(":");
            if (parts.length >= 4) {
                String showtimeId = parts[2];
                String activeKey = "queue:active:" + showtimeId;

                // Giảm active count khi thẻ hết hạn
                Long currentCount = redisTemplate.opsForValue().decrement(activeKey);
                if (currentCount != null && currentCount < 0) {
                    redisTemplate.opsForValue().set(activeKey, "0");
                }

                System.out.println("Queue pass expired for showtime: " + showtimeId + ", active count decremented");
            }
        }
    }
}

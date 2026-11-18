package com.ticketrush.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes WebSocket messages to Redis so every application instance can
 * forward them to the clients connected to that instance.
 *
 * <p>We intentionally use Redis Pub/Sub instead of the in-memory STOMP broker
 * alone: with an Auto Scaling Group, the instance that handled a request is
 * usually not the instance holding the browser's WebSocket connection.</p>
 */
@Service
@RequiredArgsConstructor
public class RealtimePublisher {

    public static final String CHANNEL = "ticketrush:ws";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /** Broadcast to every subscriber of a public topic. */
    public void publish(String destination, Object payload) {
        send(destination, payload, null);
    }

    /**
     * Deliver only to the STOMP session authenticated as {@code userId}.
     * User ids are never part of the public broadcast payload.
     */
    public void publishToUser(String userId, String destination, Object payload) {
        send(destination, payload, userId);
    }

    private void send(String destination, Object payload, String userId) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("destination", destination);
        if (userId != null) {
            envelope.put("user", userId);
        }
        envelope.put("payload", payload);

        try {
            redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize realtime message for " + destination, e);
        }
    }
}

package com.ticketrush.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Receives realtime messages from Redis and delivers them to the local STOMP
 * broker. Every instance subscribes to the same channel, so a client receives
 * an event regardless of which instance produced it.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class RedisRealtimeSubscriber implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            JsonNode root = objectMapper.readTree(message.getBody());
            String destination = root.path("destination").asText();
            if (destination.isBlank()) {
                return;
            }

            JsonNode payload = root.path("payload");
            Object body = objectMapper.convertValue(payload, Object.class);
            messagingTemplate.convertAndSend(destination, body);
        } catch (Exception e) {
            log.warn("Ignoring malformed realtime message", e);
        }
    }
}

package com.ticketrush.config;

import com.ticketrush.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.websocket.allowed-origin-patterns:http://localhost:5173}")
    private String[] allowedOriginPatterns;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{10_000, 10_000})
                .setTaskScheduler(webSocketHeartbeatScheduler());
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Public topics stay readable without a token. User-scoped destinations
        // require an authenticated CONNECT so grants are never broadcast.
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor headers = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (headers == null) {
                    return message;
                }
                if (headers.getMessageType() == SimpMessageType.CONNECT) {
                    authenticate(headers);
                }
                if (headers.getMessageType() == SimpMessageType.MESSAGE) {
                    throw new MessageDeliveryException("Client publishing is not allowed");
                }
                return message;
            }
        });
    }

    private void authenticate(StompHeaderAccessor headers) {
        String token = resolveToken(headers);
        if (!StringUtils.hasText(token)) {
            return;
        }
        if (!jwtTokenProvider.validateToken(token)) {
            throw new MessageDeliveryException("Invalid WebSocket authentication token");
        }
        String userId = jwtTokenProvider.getUserIdFromToken(token).toString();
        String role = jwtTokenProvider.getRoleFromToken(token);
        String authority = "ROLE_" + (role == null || role.isBlank() ? "USER" : role.toUpperCase());
        headers.setUser(new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority(authority))));
        log.debug("Authenticated STOMP session for user {}", userId);
    }

    private static String resolveToken(StompHeaderAccessor headers) {
        String header = headers.getFirstNativeHeader("Authorization");
        if (!StringUtils.hasText(header)) {
            header = headers.getFirstNativeHeader("token");
        }
        if (!StringUtils.hasText(header)) {
            return null;
        }
        return header.startsWith("Bearer ") ? header.substring(7) : header;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Native WebSocket only. SockJS fallback adds XHR polling/sticky-session
        // complexity when running behind CloudFront and an ALB.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOriginPatterns);
    }

    @Bean(name = "taskScheduler")
    @Primary
    public ThreadPoolTaskScheduler webSocketHeartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }
}

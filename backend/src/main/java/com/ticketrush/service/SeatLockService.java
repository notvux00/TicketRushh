package com.ticketrush.service;

import com.ticketrush.realtime.RealtimePublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SeatLockService {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private RealtimePublisher realtimePublisher;

    @Autowired
    private VirtualQueueService virtualQueueService;

    private static final int LOCK_TTL_SECONDS = 600; // 10 minutes
    private static final long LOCK_TTL_MILLIS = LOCK_TTL_SECONDS * 1000L;

    private static final DefaultRedisScript<Long> UNLOCK_SEAT_SCRIPT = new DefaultRedisScript<>("""
            if redis.call('GET', KEYS[1]) == ARGV[1] then
              return redis.call('DEL', KEYS[1])
            end
            return 0
            """, Long.class);

    /**
     * Acquire all seat locks or none. Existing locks owned by the same user are
     * renewed, which makes refresh (F5) safe.
     */
    private static final DefaultRedisScript<Long> LOCK_SEATS_SCRIPT = new DefaultRedisScript<>("""
            local userId = ARGV[1]
            local lockValue = ARGV[2]
            local ttl = tonumber(ARGV[3])
            for i = 1, #KEYS do
              local current = redis.call('GET', KEYS[i])
              if current then
                if current ~= userId and string.sub(current, 1, string.len(userId) + 1) ~= userId .. ':' then
                  return 0
                end
              end
            end
            for i = 1, #KEYS do
              redis.call('SET', KEYS[i], lockValue, 'PX', ttl)
            end
            return 1
            """, Long.class);

    /**
     * Lock multiple seats for a user
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public boolean lockSeats(UUID showtimeId, List<UUID> seatIds, String userId) {
        return lockSeats(showtimeId, seatIds, userId, null);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public boolean lockSeats(UUID showtimeId, List<UUID> seatIds, String userId, UUID orderId) {
        if (seatIds == null || seatIds.isEmpty()) {
            return false;
        }

        List<com.ticketrush.model.entity.Seat> seats = seatRepository.findAllById(seatIds);
        if (seats.size() != seatIds.size()) {
            throw new IllegalArgumentException("Some seats were not found or repeated");
        }
        for (var seat : seats) {
            if (!seat.getZone().getShowtime().getId().equals(showtimeId)) {
                throw new IllegalArgumentException("Seats do not belong to this showtime");
            }
            if (!"AVAILABLE".equalsIgnoreCase(seat.getStatus()) && !"LOCKED".equalsIgnoreCase(seat.getStatus())) {
                throw new IllegalArgumentException("Seat is not bookable");
            }
        }
        com.ticketrush.util.EventTime.requireSalesOpen(seats.get(0).getZone().getShowtime().getStartTime());
        Integer configuredLimit = seats.get(0).getZone().getShowtime().getEvent().getMaxTicketsPerOrder();
        int limit = configuredLimit != null && configuredLimit > 0 ? configuredLimit : 4;
        if (seats.size() > limit) {
            throw new IllegalArgumentException("Max tickets per order exceeded");
        }
        // Membership is established before the caller's showtime ID is used for admission or Redis keys.
        virtualQueueService.requireBookingAccess(seats.get(0).getZone().getShowtime().getId(), userId);

        String lockValue = orderId == null ? userId : userId + ":" + orderId;
        List<String> keys = seatIds.stream()
                .map(seatId -> "lock:seat:" + showtimeId + ":" + seatId)
                .toList();

        Long result = redisTemplate.execute(
                LOCK_SEATS_SCRIPT,
                keys,
                userId,
                lockValue,
                String.valueOf(LOCK_TTL_MILLIS));

        if (result == null || result != 1L) {
            return false;
        }

        // Broadcast to WebSocket that seats are LOCKED
        for (UUID seatId : seatIds) {
            Map<String, String> payload = new HashMap<>();
            payload.put("seatId", seatId.toString());
            payload.put("status", "LOCKED");
            realtimePublisher.publish("/topic/events/showtimes/" + showtimeId + "/seats", payload);
        }

        return true;
    }

    /**
     * Unlock multiple seats manually (e.g. user cancels)
     */
    public void unlockSeats(UUID showtimeId, List<UUID> seatIds, String userId) {
        for (UUID seatId : seatIds) {
            String key = "lock:seat:" + showtimeId + ":" + seatId;
            String locker = redisTemplate.opsForValue().get(key);
            
            if (isOwnedByUser(locker, userId)) {
                Long deleted = redisTemplate.execute(UNLOCK_SEAT_SCRIPT, List.of(key), locker);
                if (!Long.valueOf(1).equals(deleted)) {
                    continue;
                }
                
                // Broadcast AVAILABLE
                Map<String, String> payload = new HashMap<>();
                payload.put("seatId", seatId.toString());
                payload.put("status", "AVAILABLE");
                realtimePublisher.publish("/topic/events/showtimes/" + showtimeId + "/seats", payload);
            }
        }
    }

    public boolean isSeatLocked(UUID showtimeId, UUID seatId) {
        String key = "lock:seat:" + showtimeId + ":" + seatId;
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Batch check: trả về tập hợp các seatId đang bị khóa trong Redis.
     * Dùng pipeline để thực hiện 1 round-trip duy nhất thay vì N round-trips riêng lᮣ.
     */
    public Set<UUID> getLockedSeatIds(UUID showtimeId, List<UUID> seatIds) {
        if (seatIds == null || seatIds.isEmpty()) return Set.of();

        List<Object> results = redisTemplate.executePipelined((org.springframework.data.redis.core.RedisCallback<Object>) connection -> {
            for (UUID seatId : seatIds) {
                String key = "lock:seat:" + showtimeId + ":" + seatId;
                connection.keyCommands().exists(key.getBytes());
            }
            return null;
        });

        Set<UUID> locked = new HashSet<>();
        for (int i = 0; i < seatIds.size(); i++) {
            Object result = results.get(i);
            if (result instanceof Boolean && (Boolean) result) {
                locked.add(seatIds.get(i));
            } else if (result instanceof Long && (Long) result > 0) {
                locked.add(seatIds.get(i));
            }
        }
        return locked;
    }

    public boolean isLockedByUser(UUID showtimeId, UUID seatId, String userId) {
        if (userId == null) return false;
        String key = "lock:seat:" + showtimeId + ":" + seatId;
        String existingLocker = redisTemplate.opsForValue().get(key);
        return isOwnedByUser(existingLocker, userId);
    }

    public boolean ownsAllLocks(UUID showtimeId, List<UUID> seatIds, String userId, UUID orderId) {
        String expected = userId + ":" + orderId;
        for (UUID seatId : seatIds) {
            String key = "lock:seat:" + showtimeId + ":" + seatId;
            String locker = redisTemplate.opsForValue().get(key);
            if (!expected.equals(locker) && !userId.equals(locker)) {
                return false;
            }
        }
        return true;
    }

    public boolean isOwnedByUser(String locker, String userId) {
        return locker != null && (locker.equals(userId) || locker.startsWith(userId + ":"));
    }

    /**
     * Batch fetch: returns a map of seatId -> locker string for the requested seats.
     */
    public java.util.Map<UUID, String> getLockedSeatsInfo(UUID showtimeId, List<UUID> seatIds) {
        if (seatIds == null || seatIds.isEmpty()) return java.util.Map.of();
        
        List<String> keys = seatIds.stream()
                .map(id -> "lock:seat:" + showtimeId + ":" + id)
                .collect(Collectors.toList());
                
        List<String> values = redisTemplate.opsForValue().multiGet(keys);
        
        java.util.Map<UUID, String> lockedInfo = new java.util.HashMap<>();
        for (int i = 0; i < seatIds.size(); i++) {
            String value = values.get(i);
            if (value != null) {
                lockedInfo.put(seatIds.get(i), value);
            }
        }
        return lockedInfo;
    }

    @Autowired
    private com.ticketrush.repository.SeatRepository seatRepository;

}

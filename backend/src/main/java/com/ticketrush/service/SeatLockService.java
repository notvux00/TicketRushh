package com.ticketrush.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
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
    private SimpMessagingTemplate messagingTemplate;

    private static final int LOCK_TTL_SECONDS = 600; // 10 minutes

    /**
     * Lock multiple seats for a user
     */
    public boolean lockSeats(UUID showtimeId, List<UUID> seatIds, String userId) {
        return lockSeats(showtimeId, seatIds, userId, null);
    }

    public boolean lockSeats(UUID showtimeId, List<UUID> seatIds, String userId, UUID orderId) {
        if (seatIds == null || seatIds.isEmpty()) {
            return false;
        }

        String lockValue = orderId == null ? userId : userId + ":" + orderId;

        // Try to lock all seats atomically if possible.
        // For simplicity in Redis, we use a loop with SETNX.
        // If one fails, we must rollback the successful ones.
        boolean allLocked = true;
        for (UUID seatId : seatIds) {
            String key = "lock:seat:" + showtimeId + ":" + seatId;
            Boolean locked = redisTemplate.opsForValue().setIfAbsent(key, lockValue, Duration.ofSeconds(LOCK_TTL_SECONDS));
            
            if (Boolean.FALSE.equals(locked)) {
                // Ghế đã bị khóa. Kiểm tra xem ai là người khóa?
                String existingLocker = redisTemplate.opsForValue().get(key);
                if (isOwnedByUser(existingLocker, userId)) {
                    // Ghế này đã được chính user này khóa từ trước (do F5 tải lại trang)
                    // Gia hạn lại thời gian 10 phút và coi như thành công
                    redisTemplate.opsForValue().set(key, lockValue, Duration.ofSeconds(LOCK_TTL_SECONDS));
                } else {
                    // Người khác đang giữ ghế này
                    allLocked = false;
                    break;
                }
            }
        }

        if (!allLocked) {
            // Rollback already locked seats in this attempt
            for (UUID seatId : seatIds) {
                String key = "lock:seat:" + showtimeId + ":" + seatId;
                String locker = redisTemplate.opsForValue().get(key);
                if (lockValue.equals(locker)) {
                    redisTemplate.delete(key);
                }
            }
            return false; // Failed to lock all
        }

        // Broadcast to WebSocket that seats are LOCKED
        for (UUID seatId : seatIds) {
            Map<String, String> payload = new HashMap<>();
            payload.put("seatId", seatId.toString());
            payload.put("status", "LOCKED");
            messagingTemplate.convertAndSend("/topic/events/showtimes/" + showtimeId + "/seats", payload);
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
                redisTemplate.delete(key);
                
                // Broadcast AVAILABLE
                Map<String, String> payload = new HashMap<>();
                payload.put("seatId", seatId.toString());
                payload.put("status", "AVAILABLE");
                messagingTemplate.convertAndSend("/topic/events/showtimes/" + showtimeId + "/seats", payload);
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

    @Autowired
    private com.ticketrush.repository.OrderRepository orderRepository;

    @Autowired
    private com.ticketrush.repository.TicketRepository ticketRepository;

    @Autowired
    private com.ticketrush.repository.UserRepository userRepository;

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SeatLockService.class);

    /**
     * Confirm booking: Create Order & Tickets, Update DB to SOLD, clear Redis lock, and broadcast
     */
    @jakarta.transaction.Transactional
    public boolean confirmSeats(UUID showtimeId, List<UUID> seatIds, String userId) {
        log.info("Confirming seats for user: {}", userId);
        // 1. Verify user owns all locks in Redis
        for (UUID seatId : seatIds) {
            String key = "lock:seat:" + showtimeId + ":" + seatId;
            String locker = redisTemplate.opsForValue().get(key);
            if (!isOwnedByUser(locker, userId)) {
                return false; 
            }
        }

        // 2. Fetch User from DB (Supabase ID = userId). If not exists, create a JIT record.
        com.ticketrush.model.entity.User user = userRepository.findById(UUID.fromString(userId))
                .orElseGet(() -> {
                    log.info("User {} not found in local DB, creating JIT record", userId);
                    com.ticketrush.model.entity.User newUser = new com.ticketrush.model.entity.User();
                    newUser.setId(UUID.fromString(userId));
                    newUser.setEmail("user-" + userId + "@example.com"); // Placeholder email
                    newUser.setRole("USER");
                    return userRepository.save(newUser);
                });

        // 3. Fetch Seats and calculate total price
        List<com.ticketrush.model.entity.Seat> seats = seatRepository.findAllById(seatIds);
        double total = 0;
        for (com.ticketrush.model.entity.Seat seat : seats) {
            if (seat.getZone() != null) {
                total += seat.getZone().getPrice();
            }
            seat.setStatus("SOLD");
        }

        // 4. Create and Save Order
        com.ticketrush.model.entity.Order order = new com.ticketrush.model.entity.Order();
        order.setUser(user);
        order.setTotalPrice(total);
        order.setStatus("COMPLETED");
        order = orderRepository.save(order);

        // 5. Create and Save Tickets
        for (com.ticketrush.model.entity.Seat seat : seats) {
            com.ticketrush.model.entity.Ticket ticket = new com.ticketrush.model.entity.Ticket();
            ticket.setOrder(order);
            ticket.setSeat(seat);
            ticket.setQrCode("https://suvvqekfdveuionhrsou.supabase.co/storage/v1/object/public/qr/qr_for_all.png"); // Use fixed Supabase QR link
            ticketRepository.save(ticket);
        }

        // 6. Update Seat status in DB
        seatRepository.saveAll(seats);

        // 7. Clear Redis and Broadcast SOLD status
        for (UUID seatId : seatIds) {
            String key = "lock:seat:" + showtimeId + ":" + seatId;
            redisTemplate.delete(key);

            Map<String, String> payload = new HashMap<>();
            payload.put("seatId", seatId.toString());
            payload.put("status", "SOLD");
            messagingTemplate.convertAndSend("/topic/events/showtimes/" + showtimeId + "/seats", payload);
        }

        return true;
    }
}

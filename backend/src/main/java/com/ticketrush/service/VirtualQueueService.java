package com.ticketrush.service;

import com.ticketrush.model.dto.QueueStatusResponse;
import com.ticketrush.realtime.RealtimePublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class VirtualQueueService {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private RealtimePublisher realtimePublisher;

    private static final int DEFAULT_ACTIVATION_THRESHOLD = 200;
    private static final int DEFAULT_BATCH_SIZE = 50;
    private static final int DEFAULT_MAX_CAPACITY = 1000000; // Mặc định "không giới hạn"
    @org.springframework.beans.factory.annotation.Value("${app.queue.pass-ttl-seconds:600}")
    private int passTtlSeconds = 600; // 10 phút

    private String maxCapacityKey(UUID showtimeId) {
        return "queue:maxCapacity:" + showtimeId;
    }

    private String batchSizeKey(UUID showtimeId) {
        return "queue:batchSize:" + showtimeId;
    }

    // ═══════════════════════════════════════════
    // Redis Key Patterns
    // ═══════════════════════════════════════════
    // queue:waiting:{showtimeId}           → Sorted Set (hàng chờ, score=timestamp)
    // queue:active:{showtimeId}            → String counter (số người đang trong booking)
    // queue:pass:{showtimeId}:{userId}     → String "1" EX 600 (thẻ vào cửa)
    // queue:threshold:{showtimeId}         → String (ngưỡng custom, nếu không set dùng DEFAULT)

    private String waitingKey(UUID showtimeId) {
        return "queue:waiting:" + showtimeId;
    }

    private String activeKey(UUID showtimeId) { return "queue:active:" + showtimeId; }
    private String leaseKey(UUID showtimeId) { return "queue:leases:" + showtimeId; }
    private String indexedKey(UUID showtimeId) { return "queue:indexed:" + showtimeId; }
    private String passPrefix(UUID showtimeId) { return "queue:pass:" + showtimeId + ":"; }
    private List<String> ledgerKeys(UUID showtimeId) {
        return List.of(leaseKey(showtimeId), activeKey(showtimeId), indexedKey(showtimeId));
    }
    private List<String> mutationKeys(UUID showtimeId, String userId) {
        return List.of(leaseKey(showtimeId), activeKey(showtimeId), indexedKey(showtimeId),
                passKey(showtimeId, userId), waitingKey(showtimeId));
    }

    private String passKey(UUID showtimeId, String userId) {
        return "queue:pass:" + showtimeId + ":" + userId;
    }

    private String thresholdKey(UUID showtimeId) {
        return "queue:threshold:" + showtimeId;
    }

    /**
     * Kiểm tra user có cần xếp hàng không. Nếu không, cấp thẻ vào cửa luôn.
     * Nếu user đã có thẻ rồi (quay lại), cho vào luôn.
     * Nếu user đã trong hàng chờ (F5), giữ vị trí cũ.
     */
    public QueueStatusResponse checkAndEnqueue(UUID showtimeId, String userId) {
        QueueStatusResponse response = new QueueStatusResponse();

        // 1. Kiểm tra user đã có thẻ vào cửa chưa (quay lại sau khi đã được grant)
        if (hasValidPass(showtimeId, userId)) {
            response.setNeedQueue(false);
            response.setAccessGranted(true);
            response.setMessage("Bạn đã có quyền truy cập. Đang chuyển vào trang đặt vé...");
            return response;
        }

        int activeCount = getActiveCount(showtimeId);
        int threshold = getThreshold(showtimeId);

        String waitKey = waitingKey(showtimeId);
        Long queueSize = redisTemplate.opsForZSet().size(waitKey);
        if (queueSize == null) queueSize = 0L;

        // 2. Nếu chưa quá tải VÀ không có ai đang chờ → cấp thẻ vào luôn
        if (activeCount < threshold && queueSize == 0
                && grantPass(showtimeId, userId, Math.min(threshold, getMaxCapacity(showtimeId)), true) > 0) {
            response.setNeedQueue(false);
            response.setAccessGranted(true);
            response.setActiveUsers(getActiveCount(showtimeId));
            response.setMessage("Chào mừng! Đang chuyển vào trang đặt vé...");
            return response;
        }

        // 3. Quá tải hoặc có người đang chờ → đưa vào hàng chờ
        Double existingScore = redisTemplate.opsForZSet().score(waitKey, userId);

        if (existingScore == null) {
            // User chưa trong hàng chờ → thêm mới
            redisTemplate.opsForZSet().add(waitKey, userId, System.currentTimeMillis());
            queueSize++;
        }
        // Nếu đã có (F5) → không thêm lại, giữ score cũ = giữ vị trí

        Long position = redisTemplate.opsForZSet().rank(waitKey, userId);

        response.setNeedQueue(true);
        response.setAccessGranted(false);
        response.setPosition(position != null ? position.intValue() + 1 : null); // 1-indexed
        response.setTotalInQueue(queueSize.intValue());
        response.setActiveUsers(activeCount);
        response.setEstimatedWaitSeconds(estimateWait(position != null ? position.intValue() + 1 : 0, showtimeId));
        response.setMessage("Bạn đang trong hàng chờ. Vui lòng không đóng tab.");
        return response;
    }

    /**
     * Lấy trạng thái hiện tại (dùng cho polling / F5)
     */
    public QueueStatusResponse getStatus(UUID showtimeId, String userId) {
        QueueStatusResponse response = new QueueStatusResponse();

        if (hasValidPass(showtimeId, userId)) {
            response.setNeedQueue(false);
            response.setAccessGranted(true);
            response.setMessage("Bạn đã có quyền truy cập.");
            return response;
        }

        int activeCount = getActiveCount(showtimeId);
        int threshold = getThreshold(showtimeId);

        String waitKey = waitingKey(showtimeId);
        Long position = redisTemplate.opsForZSet().rank(waitKey, userId);
        Long totalInQueue = redisTemplate.opsForZSet().size(waitKey);

        if (position == null) {
            // User chưa trong hàng chờ và chưa có thẻ
            response.setNeedQueue(activeCount >= threshold);
            response.setAccessGranted(false);
            response.setActiveUsers(activeCount);
            return response;
        }

        response.setNeedQueue(true);
        response.setAccessGranted(false);
        response.setPosition(position.intValue() + 1);
        response.setTotalInQueue(totalInQueue != null ? totalInQueue.intValue() : 0);
        response.setActiveUsers(activeCount);
        response.setEstimatedWaitSeconds(estimateWait(position.intValue() + 1, showtimeId));
        response.setMessage("Bạn đang trong hàng chờ. Vui lòng không đóng tab.");
        return response;
    }

    /**
     * Cấp thẻ vào cửa cho batch tiếp theo. Trả về số người được cấp.
     */
    public int grantNextBatch(UUID showtimeId) {
        int activeCount = getActiveCount(showtimeId);
        int maxCapacity = getMaxCapacity(showtimeId);
        int availableSlots = maxCapacity - activeCount;

        if (availableSlots <= 0) return 0;

        int batchSize = getBatchSize(showtimeId);
        // Trong chế độ "Drip Entry", chúng ta luôn cho phép batchSize người vào 
        // nếu chưa chạm trần Max Capacity cực lớn.
        int toGrant = Math.min(availableSlots, batchSize);
        // Protect against legacy or externally written invalid Redis configuration.
        if (toGrant <= 0) return 0;
        String waitKey = waitingKey(showtimeId);

        // Lấy top N users từ Sorted Set (FIFO — score nhỏ nhất = vào trước)
        Set<String> topUsers = redisTemplate.opsForZSet().range(waitKey, 0, toGrant - 1);
        if (topUsers == null || topUsers.isEmpty()) return 0;

        int granted = 0;
        for (String userId : topUsers) {
            long outcome = grantPass(showtimeId, userId, maxCapacity, false);
            if (outcome == 0) break;
            if (outcome == 1) granted++;

            // Broadcast ACCESS_GRANTED cho user cụ thể qua WebSocket
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "ACCESS_GRANTED");
            payload.put("userId", userId);
            realtimePublisher.publish("/topic/queue/" + showtimeId, payload);
        }

        // Broadcast POSITION_UPDATE cho tất cả users còn lại trong hàng chờ
        broadcastPositionUpdates(showtimeId);

        return granted;
    }

    /**
     * Broadcast cập nhật vị trí cho tất cả users trong hàng chờ
     */
    public void broadcastPositionUpdates(UUID showtimeId) {
        String waitKey = waitingKey(showtimeId);
        Long totalInQueue = redisTemplate.opsForZSet().size(waitKey);

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "POSITION_UPDATE");
        payload.put("totalInQueue", totalInQueue != null ? totalInQueue.intValue() : 0);
        payload.put("activeUsers", getActiveCount(showtimeId));
        realtimePublisher.publish("/topic/queue/" + showtimeId, payload);
    }

    /**
     * Kiểm tra thẻ vào cửa hợp lệ
     */
    public boolean hasValidPass(UUID showtimeId, String userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(passKey(showtimeId, userId)));
    }

    public boolean canBook(UUID showtimeId, String userId) {
        // Direct API clients must reserve the same admission lease as clients
        // entering through queue/status. Lua checks capacity and waiting users
        // atomically; an existing holder is allowed without consuming twice.
        return grantPass(showtimeId, userId,
                Math.min(getThreshold(showtimeId), getMaxCapacity(showtimeId)), true) > 0;
    }

    public void requireBookingAccess(UUID showtimeId, String userId) {
        if (!canBook(showtimeId, userId)) {
            throw new IllegalStateException("QUEUE_ACCESS_REQUIRED");
        }
    }

    /**
     * Cấp thẻ vào cửa + tăng active count
     */
    private long grantPass(UUID showtimeId, String userId, int limit, boolean respectWaiting) {
        if (passTtlSeconds <= 0 || passTtlSeconds > 600) throw new IllegalStateException("Pass TTL must be between 1 and 600 seconds");
        Long result = redisTemplate.execute(QueuePassLedger.GRANT, mutationKeys(showtimeId, userId),
                passPrefix(showtimeId), Long.toString(passTtlSeconds * 1000L), Integer.toString(limit), respectWaiting ? "1" : "0");
        return result == null ? 0 : result;
    }

    /**
     * Giảm active count (khi user rời booking: checkout xong, hủy, close tab, thẻ hết hạn)
     */
    public void releaseSlot(UUID showtimeId, String userId) {
        redisTemplate.execute(QueuePassLedger.RELEASE, mutationKeys(showtimeId, userId), passPrefix(showtimeId));
    }

    /**
     * User tự rời hàng chờ
     */
    public void leaveQueue(UUID showtimeId, String userId) {
        redisTemplate.opsForZSet().remove(waitingKey(showtimeId), userId);
    }

    // ═══════════════════════════════════════════
    // Admin: Demo Mode
    // ═══════════════════════════════════════════

    /**
     * Đặt ngưỡng kích hoạt cho showtime (dùng để demo trên localhost)
     */
    public void setThreshold(UUID showtimeId, int threshold) {
        redisTemplate.opsForValue().set(thresholdKey(showtimeId), String.valueOf(threshold));
    }

    /**
     * Đặt số người được vào mỗi đợt cho showtime
     */
    public void setBatchSize(UUID showtimeId, int batchSize) {
        if (batchSize <= 0) throw new IllegalArgumentException("Batch size must be positive");
        redisTemplate.opsForValue().set(batchSizeKey(showtimeId), String.valueOf(batchSize));
    }

    /**
     * Inject fake users vào hàng chờ (dùng để demo)
     */
    public int simulateUsers(UUID showtimeId, int count) {
        String waitKey = waitingKey(showtimeId);
        long baseTimestamp = System.currentTimeMillis() - (count * 100L); // Fake timestamps trước hiện tại
        for (int i = 0; i < count; i++) {
            String fakeUserId = "fake-user-" + UUID.randomUUID().toString().substring(0, 8);
            redisTemplate.opsForZSet().add(waitKey, fakeUserId, baseTimestamp + (i * 100L));
        }
        return count;
    }

    /**
     * Reset toàn bộ queue cho showtime
     */
    public void resetQueue(UUID showtimeId) {
        redisTemplate.execute(QueuePassLedger.RESET,
                List.of(waitingKey(showtimeId), activeKey(showtimeId), leaseKey(showtimeId), indexedKey(showtimeId),
                        thresholdKey(showtimeId), batchSizeKey(showtimeId)), passPrefix(showtimeId));
    }

    // ═══════════════════════════════════════════
    // Internal helpers
    // ═══════════════════════════════════════════

    public int getActiveCount(UUID showtimeId) {
        Long count = redisTemplate.execute(QueuePassLedger.COUNT, ledgerKeys(showtimeId), passPrefix(showtimeId));
        return count == null ? 0 : Math.toIntExact(count);
    }

    public int getThreshold(UUID showtimeId) {
        String val = redisTemplate.opsForValue().get(thresholdKey(showtimeId));
        if (val == null) return DEFAULT_ACTIVATION_THRESHOLD;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return DEFAULT_ACTIVATION_THRESHOLD;
        }
    }

    public int getMaxCapacity(UUID showtimeId) {
        String val = redisTemplate.opsForValue().get(maxCapacityKey(showtimeId));
        if (val == null) return DEFAULT_MAX_CAPACITY;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return DEFAULT_MAX_CAPACITY;
        }
    }

    public int getBatchSize(UUID showtimeId) {
        String val = redisTemplate.opsForValue().get(batchSizeKey(showtimeId));
        if (val == null) return DEFAULT_BATCH_SIZE;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return DEFAULT_BATCH_SIZE;
        }
    }

    /**
     * Lấy danh sách tất cả showtime đang có hàng chờ
     */
    public Set<String> getActiveQueueShowtimeIds() {
        ScanOptions options = ScanOptions.scanOptions().match("queue:waiting:*").count(256).build();
        Set<String> ids = redisTemplate.execute((RedisCallback<Set<String>>) connection -> {
            Set<String> found = new HashSet<>();
            try (Cursor<byte[]> cursor = connection.scan(options)) {
                while (cursor.hasNext()) {
                    String key = new String(cursor.next());
                    found.add(key.substring("queue:waiting:".length()));
                }
            }
            return found;
        });
        return ids == null ? Set.of() : ids;
    }

    private int estimateWait(int position, UUID showtimeId) {
        if (position <= 0) return 0;
        int batchSize = getBatchSize(showtimeId);
        // Mỗi 10 giây grant batchSize người
        int batchesNeeded = (int) Math.ceil((double) position / batchSize);
        return batchesNeeded * 10;
    }
}

package com.ticketrush.service;

import com.ticketrush.model.dto.QueueStatusResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

@Service
public class VirtualQueueService {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private static final int DEFAULT_ACTIVATION_THRESHOLD = 200;
    private static final int DEFAULT_BATCH_SIZE = 50;
    private static final int DEFAULT_MAX_CAPACITY = 1000000; // Mặc định "không giới hạn"
    private static final int PASS_TTL_SECONDS = 600; // 10 phút

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

    private String activeKey(UUID showtimeId) {
        return "queue:active:" + showtimeId;
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
        if (activeCount < threshold && queueSize == 0) {
            grantPass(showtimeId, userId);
            response.setNeedQueue(false);
            response.setAccessGranted(true);
            response.setActiveUsers(activeCount + 1);
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
        String waitKey = waitingKey(showtimeId);

        // Lấy top N users từ Sorted Set (FIFO — score nhỏ nhất = vào trước)
        Set<String> topUsers = redisTemplate.opsForZSet().range(waitKey, 0, toGrant - 1);
        if (topUsers == null || topUsers.isEmpty()) return 0;

        int granted = 0;
        for (String userId : topUsers) {
            grantPass(showtimeId, userId);
            redisTemplate.opsForZSet().remove(waitKey, userId);
            granted++;

            // Broadcast ACCESS_GRANTED cho user cụ thể qua WebSocket
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "ACCESS_GRANTED");
            payload.put("userId", userId);
            messagingTemplate.convertAndSend("/topic/queue/" + showtimeId, payload);
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
        messagingTemplate.convertAndSend("/topic/queue/" + showtimeId, payload);
    }

    /**
     * Kiểm tra thẻ vào cửa hợp lệ
     */
    public boolean hasValidPass(UUID showtimeId, String userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(passKey(showtimeId, userId)));
    }

    /**
     * Cấp thẻ vào cửa + tăng active count
     */
    private void grantPass(UUID showtimeId, String userId) {
        redisTemplate.opsForValue().set(passKey(showtimeId, userId), "1", Duration.ofSeconds(PASS_TTL_SECONDS));
        redisTemplate.opsForValue().increment(activeKey(showtimeId));
    }

    /**
     * Giảm active count (khi user rời booking: checkout xong, hủy, close tab, thẻ hết hạn)
     */
    public void releaseSlot(UUID showtimeId, String userId) {
        String pass = passKey(showtimeId, userId);
        if (Boolean.TRUE.equals(redisTemplate.hasKey(pass))) {
            redisTemplate.delete(pass);
        }
        Long currentCount = redisTemplate.opsForValue().decrement(activeKey(showtimeId));
        // Tránh counter âm
        if (currentCount != null && currentCount < 0) {
            redisTemplate.opsForValue().set(activeKey(showtimeId), "0");
        }
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
        redisTemplate.delete(waitingKey(showtimeId));
        redisTemplate.delete(activeKey(showtimeId));
        redisTemplate.delete(thresholdKey(showtimeId));
        redisTemplate.delete(batchSizeKey(showtimeId));

        // Xóa tất cả thẻ vào cửa (scan pattern)
        Set<String> passKeys = redisTemplate.keys("queue:pass:" + showtimeId + ":*");
        if (passKeys != null && !passKeys.isEmpty()) {
            redisTemplate.delete(passKeys);
        }
    }

    // ═══════════════════════════════════════════
    // Internal helpers
    // ═══════════════════════════════════════════

    public int getActiveCount(UUID showtimeId) {
        String val = redisTemplate.opsForValue().get(activeKey(showtimeId));
        if (val == null) return 0;
        try {
            int count = Integer.parseInt(val);
            return Math.max(count, 0);
        } catch (NumberFormatException e) {
            return 0;
        }
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
        Set<String> keys = redisTemplate.keys("queue:waiting:*");
        if (keys == null) return Set.of();
        Set<String> ids = new HashSet<>();
        for (String key : keys) {
            // key format: queue:waiting:{showtimeId}
            String id = key.replace("queue:waiting:", "");
            ids.add(id);
        }
        return ids;
    }

    private int estimateWait(int position, UUID showtimeId) {
        if (position <= 0) return 0;
        int batchSize = getBatchSize(showtimeId);
        // Mỗi 10 giây grant batchSize người
        int batchesNeeded = (int) Math.ceil((double) position / batchSize);
        return batchesNeeded * 10;
    }
}

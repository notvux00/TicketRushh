package com.ticketrush.service;

import com.ticketrush.realtime.RealtimePublisher;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@Testcontainers
class QueueLeaseRecoveryTest {
    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7")
            .withCommand("redis-server", "--notify-keyspace-events", "Ex", "--rename-command", "CONFIG", "")
            .withExposedPorts(6379);

    record Harness(LettuceConnectionFactory factory, StringRedisTemplate cache, VirtualQueueService queues)
            implements AutoCloseable {
        @Override public void close() { factory.destroy(); }
    }

    Harness connect(int ttl) {
        var factory = new LettuceConnectionFactory(new RedisStandaloneConfiguration(redis.getHost(), redis.getMappedPort(6379)));
        factory.afterPropertiesSet();
        var cache = new StringRedisTemplate(factory);
        var queues = new VirtualQueueService(cache, mock(RealtimePublisher.class));
        ReflectionTestUtils.setField(queues, "passTtlSeconds", ttl);
        return new Harness(factory, cache, queues);
    }

    @Test
    void expiredLeaseReconcilesAfterDisconnectWithoutAnyExpirySubscriber() {
        UUID show = UUID.randomUUID();
        try (var first = connect(1)) {
            first.queues().setThreshold(show, 1);
            assertTrue(first.queues().checkAndEnqueue(show, "A").isAccessGranted());
            assertEquals(1, first.queues().getActiveCount(show));
        }
        try (var restarted = connect(600)) {
            org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(4)).until(() ->
                    !Boolean.TRUE.equals(restarted.cache().hasKey("queue:pass:"+show+":A")));
            // Nothing subscribed to expiration events; the old cached count is still stale.
            assertEquals("1", restarted.cache().opsForValue().get("queue:active:"+show));
            assertEquals(0, restarted.queues().getActiveCount(show));
            assertTrue(restarted.queues().checkAndEnqueue(show, "B").isAccessGranted());
            assertEquals(1, restarted.queues().getActiveCount(show));
            restarted.queues().releaseSlot(show, "A");
            assertEquals(1, restarted.queues().getActiveCount(show));
            restarted.queues().resetQueue(show);
        }
    }

    @Test
    void oldLeakedCounterIsRepairedBeforeAdmission() {
        UUID show = UUID.randomUUID();
        try (var h = connect(600)) {
            h.cache().opsForValue().set("queue:active:"+show, "200");
            h.queues().setThreshold(show, 1);
            assertEquals(0, h.queues().getActiveCount(show));
            assertTrue(h.queues().checkAndEnqueue(show, "new-user").isAccessGranted());
            assertEquals(1, h.queues().getActiveCount(show));
            h.queues().resetQueue(show);
        }
    }

    @Test
    void directAdmissionCannotJumpExistingWaitingUsers() {
        UUID show = UUID.randomUUID();
        try (var h = connect(600)) {
            h.queues().setThreshold(show, 1);
            h.cache().opsForZSet().add("queue:waiting:"+show, "waiting", 1);
            assertFalse(h.queues().canBook(show, "new-direct-client"));
            assertEquals(0, h.queues().getActiveCount(show));
            assertEquals(1, h.queues().grantNextBatch(show));
            assertTrue(h.queues().canBook(show, "waiting"));
            assertEquals(1, h.queues().getActiveCount(show));
            h.queues().resetQueue(show);
        }
    }

    @Test
    void simultaneousDirectAdmissionsCannotBothPassThreshold() throws Exception {
        UUID show = UUID.randomUUID();
        try (var h = connect(600)) {
            h.queues().setThreshold(show, 1);
            var executor = Executors.newFixedThreadPool(2);
            var start = new CountDownLatch(1);
            try {
                var a = executor.submit(() -> { start.await(); return h.queues().canBook(show, "A"); });
                var b = executor.submit(() -> { start.await(); return h.queues().canBook(show, "B"); });
                start.countDown();
                assertNotEquals(a.get(5, TimeUnit.SECONDS), b.get(5, TimeUnit.SECONDS));
                assertEquals(1, h.queues().getActiveCount(show));
            } finally { executor.shutdownNow(); }
            h.queues().resetQueue(show);
        }
    }

    @Test
    void importsLegacyPassesAndRepairsOlderWritersWithoutDoubleExpiryDecrements() {
        UUID show = UUID.randomUUID();
        try (var h = connect(600)) {
            for (String user : List.of("A", "B")) h.cache().opsForValue().set("queue:pass:"+show+":"+user, "1", Duration.ofMinutes(5));
            h.cache().opsForValue().set("queue:active:"+show, "99");
            assertEquals(2, h.queues().getActiveCount(show));
            // Simulate a previous backend's grant after this backend has initialized its ledger.
            h.cache().opsForValue().set("queue:pass:"+show+":C", "1", Duration.ofMinutes(5));
            h.cache().opsForValue().increment("queue:active:"+show);
            assertEquals(3, h.queues().getActiveCount(show));
            h.cache().delete("queue:pass:"+show+":C");
            h.cache().opsForValue().decrement("queue:active:"+show);
            assertEquals(2, h.queues().getActiveCount(show));
            var listener = new RedisKeyExpirationListener(mock(org.springframework.data.redis.listener.RedisMessageListenerContainer.class),
                    mock(RealtimePublisher.class), h.cache(), h.queues());
            var delayed = new org.springframework.data.redis.connection.DefaultMessage(
                    ("__keyevent@0__:expired").getBytes(), ("queue:pass:"+show+":A").getBytes());
            listener.onMessage(delayed, null);
            listener.onMessage(delayed, null);
            assertEquals(2, h.queues().getActiveCount(show));
            h.queues().resetQueue(show);
        }
    }

    @Test
    void balancedLegacyReleaseAndGrantCannotHideAReplacementHolder() throws Exception {
        UUID show = UUID.randomUUID();
        try (var h = connect(1)) {
            assertTrue(h.queues().checkAndEnqueue(show, "A").isAccessGranted());
            h.cache().delete("queue:pass:"+show+":A");
            h.cache().opsForValue().decrement("queue:active:"+show);
            h.cache().opsForValue().set("queue:pass:"+show+":B", "1", Duration.ofMinutes(10));
            h.cache().opsForValue().increment("queue:active:"+show);
            assertEquals(1, h.queues().getActiveCount(show));
            h.queues().releaseSlot(show, "A");
            assertEquals(1, h.queues().getActiveCount(show));
            h.queues().releaseSlot(show, "B");
            assertEquals(0, h.queues().getActiveCount(show));

            assertTrue(h.queues().checkAndEnqueue(show, "A2").isAccessGranted());
            h.cache().delete("queue:pass:"+show+":A2");
            h.cache().opsForValue().decrement("queue:active:"+show);
            h.cache().opsForValue().set("queue:pass:"+show+":C", "1", Duration.ofMinutes(10));
            h.cache().opsForValue().increment("queue:active:"+show);
            Thread.sleep(1100);
            assertEquals(1, h.queues().getActiveCount(show));
            h.queues().releaseSlot(show, "C");
            assertEquals(0, h.queues().getActiveCount(show));
            h.queues().resetQueue(show);
        }
    }

    @Test
    void concurrentAdmissionAndReleaseRespectCapacityAndResetClearsLeases() throws Exception {
        UUID show = UUID.randomUUID();
        try (var h = connect(600)) {
            h.queues().setThreshold(show, 1);
            h.cache().opsForValue().set("queue:maxCapacity:"+show, "1");
            var executor = Executors.newFixedThreadPool(2);
            var start = new CountDownLatch(1);
            try {
                var a = executor.submit(() -> { start.await(); return h.queues().checkAndEnqueue(show, "A").isAccessGranted(); });
                var b = executor.submit(() -> { start.await(); return h.queues().checkAndEnqueue(show, "B").isAccessGranted(); });
                start.countDown();
                assertNotEquals(a.get(5, TimeUnit.SECONDS), b.get(5, TimeUnit.SECONDS));
            } finally { executor.shutdownNow(); }
            assertEquals(1, h.queues().getActiveCount(show));
            String winner = h.queues().hasValidPass(show, "A") ? "A" : "B";
            h.queues().releaseSlot(show, winner);
            h.queues().releaseSlot(show, winner);
            assertEquals(0, h.queues().getActiveCount(show));
            assertEquals(1, h.queues().grantNextBatch(show));
            assertEquals(1, h.queues().getActiveCount(show));
            h.queues().resetQueue(show);
            assertFalse(h.queues().hasValidPass(show, "A"));
            assertFalse(h.queues().hasValidPass(show, "B"));
            assertEquals(0, h.queues().getActiveCount(show));
            h.cache().delete("queue:maxCapacity:"+show);
        }
    }
}

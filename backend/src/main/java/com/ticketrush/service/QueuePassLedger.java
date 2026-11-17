package com.ticketrush.service;

import org.springframework.data.redis.core.script.DefaultRedisScript;

/** Lease deadlines survive subscriber downtime; all mutations and counts are atomic. */
final class QueuePassLedger {
    private QueuePassLedger() {}

    // KEYS: leases, legacy counter, initialized marker, optional pass, waiting set.
    // ARGV[1]: exact legacy pass-key prefix for this showtime.
    private static final String BASE = """
            local clock = redis.call('TIME')
            local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
            local function writeCount()
              local n = redis.call('ZCARD', KEYS[1])
              if redis.call('GET', KEYS[2]) ~= tostring(n) then
                redis.call('SET', KEYS[2], tostring(n))
              end
              return n
            end
            local function reconcile(force)
              local indexed = redis.call('ZCARD', KEYS[1])
              local legacy = tonumber(redis.call('GET', KEYS[2])) or 0
              if force or redis.call('EXISTS', KEYS[3]) == 0 or legacy ~= indexed
                 or redis.call('ZCOUNT', KEYS[1], '-inf', now) > 0 then
                -- Import existing passes once, or repair writes from an older
                -- backend during a rolling deployment. Normal reads use the index.
                redis.call('DEL', KEYS[1])
                local cursor = '0'
                repeat
                  local page = redis.call('SCAN', cursor, 'MATCH', ARGV[1] .. '*', 'COUNT', 256)
                  cursor = page[1]
                  for _, key in ipairs(page[2]) do
                    local ttl = redis.call('PTTL', key)
                    if ttl > 0 or ttl == -1 then
                      -- Revisit old leases at least every ten minutes, including
                      -- old keys without a TTL. This also catches balanced legacy
                      -- release/grant pairs whose counter delta was zero.
                      local deadline = now + (ttl == -1 and 600000 or math.min(ttl, 600000))
                      redis.call('ZADD', KEYS[1], deadline, string.sub(key, string.len(ARGV[1]) + 1))
                    end
                  end
                until cursor == '0'
                redis.call('SET', KEYS[3], '1')
              end
              redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
              return writeCount()
            end
            """;

    static final DefaultRedisScript<Long> COUNT = new DefaultRedisScript<>(BASE + "return reconcile()", Long.class);

    // Returns 1 for a new pass, 2 for an existing pass, 0 if admission is full.
    static final DefaultRedisScript<Long> GRANT = new DefaultRedisScript<>(BASE + """
            local n = reconcile()
            local user = string.sub(KEYS[4], string.len(ARGV[1]) + 1)
            local ttl = redis.call('PTTL', KEYS[4])
            local tracked = redis.call('ZSCORE', KEYS[1], user)
            if ((ttl > 0 or ttl == -1) and not tracked) or (ttl == -2 and tracked) then
              n = reconcile(true)
            end
            if ttl > 0 or ttl == -1 then
              redis.call('ZADD', KEYS[1], now + (ttl == -1 and 600000 or math.min(ttl, 600000)), user)
              redis.call('ZREM', KEYS[5], user)
              writeCount()
              return 2
            end
            if n >= tonumber(ARGV[3]) then return 0 end
            if ARGV[4] == '1' and redis.call('ZCARD', KEYS[5]) > 0 then return 0 end
            redis.call('SET', KEYS[4], '1', 'PX', ARGV[2])
            redis.call('ZADD', KEYS[1], now + tonumber(ARGV[2]), user)
            redis.call('ZREM', KEYS[5], user)
            writeCount()
            return 1
            """, Long.class);

    static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>(BASE + """
            reconcile()
            local user = string.sub(KEYS[4], string.len(ARGV[1]) + 1)
            local exists = redis.call('EXISTS', KEYS[4]) == 1
            local tracked = redis.call('ZSCORE', KEYS[1], user)
            if (exists and not tracked) or (not exists and tracked) then reconcile(true) end
            local deleted = redis.call('DEL', KEYS[4])
            redis.call('ZREM', KEYS[1], user)
            redis.call('ZREM', KEYS[5], user)
            writeCount()
            return deleted
            """, Long.class);

    static final DefaultRedisScript<Long> RESET = new DefaultRedisScript<>("""
            local cursor = '0'
            repeat
              local page = redis.call('SCAN', cursor, 'MATCH', ARGV[1] .. '*', 'COUNT', 256)
              cursor = page[1]
              for _, key in ipairs(page[2]) do redis.call('DEL', key) end
            until cursor == '0'
            for _, key in ipairs(KEYS) do redis.call('DEL', key) end
            return 1
            """, Long.class);
}

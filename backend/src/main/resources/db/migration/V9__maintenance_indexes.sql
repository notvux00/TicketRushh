-- Support the maintenance worker's nightly/15-minute expiry scan without
-- scanning every order. Partial index keeps it small on busy installations.
CREATE INDEX idx_orders_pending_expires_at
    ON orders (expires_at)
    WHERE status = 'PENDING';

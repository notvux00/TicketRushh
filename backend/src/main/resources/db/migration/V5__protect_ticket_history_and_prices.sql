-- Keep issued ticket history intact even if a delete races with confirmation.
CREATE FUNCTION protect_ticket_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    order_state text;
    expiry timestamp;
BEGIN
    SELECT status, expires_at INTO order_state, expiry
    FROM orders WHERE id = OLD.order_id FOR UPDATE;

    -- Hibernate stores LocalDateTime timestamps using hibernate.jdbc.time_zone=UTC.
    IF order_state = 'COMPLETED' OR OLD.status = 'CHECKED_IN'
       OR (order_state = 'PENDING' AND
           (expiry IS NULL OR expiry >= CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) THEN
        RAISE EXCEPTION 'Cannot delete issued tickets or tickets in an active checkout'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER preserve_ticket_history BEFORE DELETE ON tickets
FOR EACH ROW EXECUTE FUNCTION protect_ticket_history();

-- NOT VALID avoids changing/rejecting existing rows during rollout. New writes
-- are protected; pre-existing bad prices need explicit reconciliation later.
ALTER TABLE zones ADD CONSTRAINT zones_valid_price
    CHECK (price IS NULL OR (price >= 0 AND price < 'Infinity'::double precision)) NOT VALID;
ALTER TABLE orders ADD CONSTRAINT orders_valid_total_price
    CHECK (total_price IS NULL OR (total_price >= 0 AND total_price < 'Infinity'::double precision)) NOT VALID;

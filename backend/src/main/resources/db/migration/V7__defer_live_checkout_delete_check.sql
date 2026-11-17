-- Keep V5 unchanged for installations that have already applied it. Lock the
-- order before deletion and reject issued history immediately. Check a live
-- checkout's final state at COMMIT, allowing old clients to DELETE drafts and
-- then mark the order EXPIRED in the same transaction.
CREATE OR REPLACE FUNCTION protect_ticket_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    order_state text;
BEGIN
    SELECT status INTO order_state FROM orders WHERE id = OLD.order_id FOR UPDATE;
    IF order_state = 'COMPLETED' OR OLD.status = 'CHECKED_IN' THEN
        RAISE EXCEPTION 'Cannot delete issued ticket history' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE FUNCTION protect_checkout_after_ticket_delete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    order_state text;
    expiry timestamp;
BEGIN
    SELECT status, expires_at INTO order_state, expiry
    FROM orders WHERE id = OLD.order_id FOR UPDATE;
    IF order_state = 'COMPLETED'
       OR (order_state = 'PENDING' AND
           (expiry IS NULL OR expiry >= CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) THEN
        RAISE EXCEPTION 'Cannot remove tickets from a completed order or an active checkout'
            USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
END;
$$;

CREATE CONSTRAINT TRIGGER preserve_active_checkout
AFTER DELETE ON tickets DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION protect_checkout_after_ticket_delete();

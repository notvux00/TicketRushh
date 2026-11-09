-- Migration V3: Add unique QR payload, signature, status and checkin audit log for tickets

ALTER TABLE tickets 
    ADD COLUMN qr_payload TEXT,
    ADD COLUMN qr_signature VARCHAR(64),
    ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE',
    ADD COLUMN checked_in_at TIMESTAMP,
    ADD COLUMN checked_in_by VARCHAR(100);

UPDATE tickets 
SET status = 'ACTIVE',
    qr_payload = COALESCE(qr_code, id::text),
    qr_signature = md5(id::text)
WHERE status IS NULL;

CREATE TABLE ticket_checkins (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL,
    scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gate_name VARCHAR(50) DEFAULT 'Main Gate',
    device_id VARCHAR(100),
    staff_email VARCHAR(100),
    result VARCHAR(30) NOT NULL,
    CONSTRAINT fk_ticket_checkins_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
);

CREATE INDEX idx_tickets_status ON tickets (status);
CREATE INDEX idx_ticket_checkins_ticket_id ON ticket_checkins (ticket_id);


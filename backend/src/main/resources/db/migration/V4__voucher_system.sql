-- Migration V4: Voucher system & Order discount fields

CREATE TABLE vouchers (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    discount_type VARCHAR(20) NOT NULL, -- 'FIXED_AMOUNT' or 'PERCENTAGE'
    discount_value DOUBLE PRECISION NOT NULL,
    max_discount DOUBLE PRECISION,
    min_order_price DOUBLE PRECISION,
    total_quantity INTEGER NOT NULL DEFAULT 1000,
    used_quantity INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    event_id UUID,
    CONSTRAINT fk_vouchers_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS original_price DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS voucher_id UUID,
    ADD CONSTRAINT fk_orders_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers (id) ON DELETE SET NULL;

UPDATE orders SET original_price = total_price WHERE original_price IS NULL;

CREATE INDEX idx_vouchers_code ON vouchers (code);
CREATE INDEX idx_orders_voucher_id ON orders (voucher_id);


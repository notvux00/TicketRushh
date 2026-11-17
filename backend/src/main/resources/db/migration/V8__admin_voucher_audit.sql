-- Reuse end_date/total_quantity instead of duplicating expiry and quota fields.
ALTER TABLE vouchers ALTER COLUMN total_quantity DROP NOT NULL;
ALTER TABLE vouchers ADD COLUMN created_at timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
ALTER TABLE vouchers ADD COLUMN created_by varchar(100);

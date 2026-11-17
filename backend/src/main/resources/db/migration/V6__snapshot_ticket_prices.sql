ALTER TABLE tickets ADD COLUMN unit_price double precision;

-- Existing tickets have no historical unit-price source. Leave them unknown;
-- today's catalog and an order total cannot reconstruct their original prices.

ALTER TABLE tickets ADD CONSTRAINT tickets_valid_unit_price
    CHECK (unit_price IS NULL OR (unit_price >= 0 AND unit_price < 'Infinity'::double precision));

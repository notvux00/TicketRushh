-- TicketRush baseline schema.
-- Keep this file in sync with the JPA entities and run with ddl-auto=validate.

CREATE TABLE users (
    id uuid PRIMARY KEY,
    email varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    full_name varchar(255),
    role varchar(255),
    gender varchar(255),
    date_of_birth date,
    avatar_url varchar(255),
    phone_number varchar(255),
    CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE events (
    id uuid PRIMARY KEY,
    event_name varchar(255) NOT NULL,
    description text,
    cover_image varchar(255),
    trailer_url varchar(255),
    venue_name varchar(255),
    venue_address varchar(255),
    category varchar(255),
    max_tickets_per_order integer,
    created_by uuid,
    CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE showtimes (
    id uuid PRIMARY KEY,
    name varchar(255),
    start_time timestamp(6),
    end_time timestamp(6),
    event_id uuid NOT NULL,
    CONSTRAINT fk_showtimes_event FOREIGN KEY (event_id) REFERENCES events (id)
);

CREATE TABLE zones (
    id uuid PRIMARY KEY,
    name varchar(255),
    matrix_row integer,
    matrix_col integer,
    showtime_id uuid NOT NULL,
    position_x integer,
    position_y integer,
    visual_width integer,
    visual_height integer,
    price double precision,
    CONSTRAINT fk_zones_showtime FOREIGN KEY (showtime_id) REFERENCES showtimes (id)
);

CREATE TABLE seats (
    id uuid PRIMARY KEY,
    seat_label varchar(255),
    status varchar(255),
    grid_row integer,
    grid_col integer,
    zone_id uuid NOT NULL,
    locked_at timestamp(6),
    locked_by uuid,
    CONSTRAINT fk_seats_zone FOREIGN KEY (zone_id) REFERENCES zones (id),
    CONSTRAINT fk_seats_locked_by FOREIGN KEY (locked_by) REFERENCES users (id)
);

CREATE TABLE orders (
    id uuid PRIMARY KEY,
    total_price double precision,
    status varchar(255),
    created_at timestamp(6),
    expires_at timestamp(6),
    user_id uuid NOT NULL,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE tickets (
    id uuid PRIMARY KEY,
    qr_code varchar(255),
    order_id uuid NOT NULL,
    seat_id uuid NOT NULL,
    CONSTRAINT tickets_qr_code_key UNIQUE (qr_code),
    CONSTRAINT tickets_seat_id_key UNIQUE (seat_id),
    CONSTRAINT fk_tickets_order FOREIGN KEY (order_id) REFERENCES orders (id),
    CONSTRAINT fk_tickets_seat FOREIGN KEY (seat_id) REFERENCES seats (id)
);

-- Foreign-key indexes used by the normal read paths.
CREATE INDEX idx_events_created_by ON events (created_by);
CREATE INDEX idx_showtimes_event_id ON showtimes (event_id);
CREATE INDEX idx_zones_showtime_id ON zones (showtime_id);
CREATE INDEX idx_seats_zone_id ON seats (zone_id);
CREATE INDEX idx_seats_locked_by ON seats (locked_by);
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_tickets_order_id ON tickets (order_id);

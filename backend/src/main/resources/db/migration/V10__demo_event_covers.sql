-- Demo covers are bundled with the frontend (frontend/public/images/events).
-- The previous seed pointed at picsum.photos, which redirects to
-- fastly.picsum.photos; the CloudFront CSP blocks that host, so every demo card
-- rendered a broken image. Data-only change; a rollback re-runs the V2 inserts.

UPDATE events
SET cover_image = CASE id
        WHEN '11111111-1111-4111-8111-111111111111' THEN '/images/events/concert.jpg'
        WHEN '22222222-2222-4222-8222-222222222222' THEN '/images/events/movie.jpg'
        WHEN '33333333-3333-4333-8333-333333333333' THEN '/images/events/sports.jpg'
        WHEN '44444444-4444-4444-8444-444444444444' THEN '/images/events/comedy.jpg'
        ELSE cover_image
    END
WHERE id IN (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
);

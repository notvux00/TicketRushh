-- Demo data for local/demo environments. Do not run in production.

-- Demo seed data for TicketRush (run after backend has created schema)

INSERT INTO events (id, event_name, description, cover_image, trailer_url, venue_name, venue_address, category, max_tickets_per_order, created_by)
VALUES
 ('11111111-1111-4111-8111-111111111111',
  'Anh Trai Say Hi - Live Concert 2026',
  'Đêm nhạc bùng nổ quy tụ dàn nghệ sĩ đình đám: HIEUTHUHAI, RHYDER, Quang Hùng MasterD, Dương Domic và nhiều gương mặt khác. Sân khấu hoành tráng, hệ thống âm thanh ánh sáng đỉnh cao.',
  'https://picsum.photos/seed/anhtraisayhi/1200/700',
  null,
  'SVĐ Mỹ Đình',
  'Lê Đức Thọ, Nam Từ Liêm, Hà Nội',
  'Concert',
  4,
  NULL),
 ('22222222-2222-4222-8222-222222222222',
  'Lật Mặt 8: Vòng Tay Nắng',
  'Bộ phim hành động - gia đình mới nhất của đạo diễn Lý Hải, tiếp nối chuỗi phim ăn khách nhất phòng vé Việt Nam.',
  'https://picsum.photos/seed/latmat8/1200/700',
  null,
  'CGV Vincom Center',
  '72 Lê Thánh Tôn, Quận 1, TP.HCM',
  'Phim',
  8,
  NULL),
 ('33333333-3333-4333-8333-333333333333',
  'Sự Kiện Thể Thao: Bóng Đá Quốc Tế',
  'Trận giao hữu quốc tế hấp dẫn giữa đội tuyển Việt Nam và đội khách mời. Cổ vũ hết mình cho đội nhà!',
  'https://picsum.photos/seed/bongda/1200/700',
  null,
  'SVĐ Hàng Đẫy',
  'Đống Đa, Hà Nội',
  'Thể thao',
  6,
  NULL),
 ('44444444-4444-4444-8444-444444444444',
  'Hài Kịch: Chuyện Chưa Kể',
  'Vở kịch hài với sự tham gia của dàn diễn viên nổi tiếng, mang đến tiếng cười sảng khoái cho cả gia đình.',
  'https://picsum.photos/seed/haikich/1200/700',
  null,
  'Nhà hát Bến Thành',
  'Mạc Đĩnh Chi, Quận 1, TP.HCM',
  'Sân khấu',
  4,
  NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO showtimes (id, name, start_time, end_time, event_id) VALUES
 ('1a000000-0000-4000-8000-000000000001', 'Đêm 1 - 20:00', now() + interval '10 days', now() + interval '10 days 3 hours', '11111111-1111-4111-8111-111111111111'),
 ('1a000000-0000-4000-8000-000000000002', 'Đêm 2 - 20:00', now() + interval '11 days', now() + interval '11 days 3 hours', '11111111-1111-4111-8111-111111111111'),
 ('2b000000-0000-4000-8000-000000000001', 'Suất 19:30', now() + interval '3 days', now() + interval '3 days 2 hours', '22222222-2222-4222-8222-222222222222'),
 ('2b000000-0000-4000-8000-000000000002', 'Suất 21:45', now() + interval '3 days 3 hours', now() + interval '3 days 5 hours', '22222222-2222-4222-8222-222222222222'),
 ('3c000000-0000-4000-8000-000000000001', 'Trận đấu - 19:00', now() + interval '7 days', now() + interval '7 days 2 hours', '33333333-3333-4333-8333-333333333333'),
 ('4d000000-0000-4000-8000-000000000001', 'Suất 20:00', now() + interval '5 days', now() + interval '5 days 2 hours', '44444444-4444-4444-8444-444444444444')
ON CONFLICT (id) DO NOTHING;

INSERT INTO zones (id, name, matrix_row, matrix_col, showtime_id, position_x, position_y, visual_width, visual_height, price) VALUES
 ('a1000000-0000-4000-8000-000000000001', 'VIP', 4, 8, '1a000000-0000-4000-8000-000000000001', 40, 20, 260, 120, 2500000),
 ('a1000000-0000-4000-8000-000000000002', 'Standard', 6, 10, '1a000000-0000-4000-8000-000000000001', 40, 180, 320, 180, 1200000),
 ('a1000000-0000-4000-8000-000000000003', 'VIP', 4, 8, '1a000000-0000-4000-8000-000000000002', 40, 20, 260, 120, 2500000),
 ('a1000000-0000-4000-8000-000000000004', 'Standard', 6, 10, '1a000000-0000-4000-8000-000000000002', 40, 180, 320, 180, 1200000),
 ('b2000000-0000-4000-8000-000000000001', 'Ghế Thường', 5, 10, '2b000000-0000-4000-8000-000000000001', 40, 20, 340, 160, 90000),
 ('b2000000-0000-4000-8000-000000000002', 'Ghế Đôi', 3, 6, '2b000000-0000-4000-8000-000000000001', 40, 200, 240, 100, 180000),
 ('b2000000-0000-4000-8000-000000000003', 'Ghế Thường', 5, 10, '2b000000-0000-4000-8000-000000000002', 40, 20, 340, 160, 90000),
 ('c3000000-0000-4000-8000-000000000001', 'Khán Đài A', 6, 12, '3c000000-0000-4000-8000-000000000001', 40, 20, 380, 180, 500000),
 ('c3000000-0000-4000-8000-000000000002', 'Khán Đài B', 6, 12, '3c000000-0000-4000-8000-000000000001', 40, 220, 380, 180, 300000),
 ('d4000000-0000-4000-8000-000000000001', 'Hạng A', 4, 8, '4d000000-0000-4000-8000-000000000001', 40, 20, 260, 120, 450000),
 ('d4000000-0000-4000-8000-000000000002', 'Hạng B', 5, 10, '4d000000-0000-4000-8000-000000000001', 40, 180, 320, 200, 300000)
ON CONFLICT (id) DO NOTHING;

-- Generate seats for every zone: matrix_row x matrix_col
INSERT INTO seats (id, seat_label, status, grid_row, grid_col, zone_id)
SELECT gen_random_uuid(),
       chr(64 + r) || c,
       'AVAILABLE',
       r,
       c,
       z.id
FROM zones z
CROSS JOIN generate_series(1, z.matrix_row) AS r
CROSS JOIN generate_series(1, z.matrix_col) AS c
WHERE NOT EXISTS (SELECT 1 FROM seats s WHERE s.zone_id = z.id);


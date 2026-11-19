-- Additional demo catalog: more events, showtimes, zones and seats.
-- Data-only demo migration; ids are deterministic so a rollback can delete by ids.
-- Image assets are bundled in frontend/public/images/events (see IMAGE_CREDITS).

INSERT INTO events (id, event_name, description, cover_image, trailer_url, venue_name, venue_address, category, max_tickets_per_order, created_by) VALUES
 ('55555555-5555-4555-8555-555555555555', 'Sài Gòn Indie Fest 2026', 'Liên hoan âm nhạc indie ngoài trời với 12 nghệ sĩ trẻ, hai sân khấu, khu food truck và không gian sáng tạo dành cho khán giả từ 16 tuổi.', '/images/events/festival.jpg', NULL, 'SECC — Trung tâm Hội chợ & Triển lãm Sài Gòn', '799 Nguyễn Văn Linh, Quận 7, TP.HCM', 'Concert', 6, NULL),
 ('66666666-6666-4666-8666-666666666666', 'Giao Hưởng Mùa Đông: Beethoven & Dvořák', 'Đêm hòa nhạc với Dàn nhạc Giao hưởng Quốc gia, trình diễn Concerto cho piano của Beethoven và Giao hưởng số 9 “Từ Thế Giới Mới” của Dvořák.', '/images/events/orchestra.jpg', NULL, 'Nhà hát Lớn Hà Nội', '1 Tràng Tiền, Hoàn Kiếm, Hà Nội', 'Concert', 4, NULL),
 ('77777777-7777-4777-8777-777777777777', 'Kịch: Người Vợ Ma', 'Vở kịch tâm lý - hài với dàn diễn viên Idecaf, kể câu chuyện về một gia đình bị xáo trộn bởi những bí mật chưa kể. Phù hợp khán giả từ 13 tuổi.', '/images/events/theater.jpg', NULL, 'Sân khấu Idecaf', '28 Lê Thánh Tôn, Quận 1, TP.HCM', 'Sân khấu', 4, NULL),
 ('88888888-8888-4888-8888-888888888888', 'Suất Chiếu Đặc Biệt: Phim Việt Kinh Điển', 'Chuỗi suất chiếu phục hồi bản đẹp của những bộ phim Việt được yêu thích, kèm phần giới thiệu ngắn từ nhà phê bình điện ảnh trước giờ chiếu.', '/images/events/cinema.jpg', NULL, 'BHD Star Cineplex Thảo Điền', 'Tầng 5 Vincom Thảo Điền, Quận 2, TP.HCM', 'Phim', 6, NULL),
 ('99999999-9999-4999-8999-999999999999', 'VBA 2026: Sài Gòn Heat vs Hà Nội Buffaloes', 'Trận đấu tâm điểm vòng bảng VBA 2026 giữa Sài Gòn Heat và Hà Nội Buffaloes. Cổ động viên được tặng cờ và sticker tại cửa vào.', '/images/events/basketball.jpg', NULL, 'Nhà thi đấu CIS', 'Đường số 7, Khu đô thị Phú Mỹ Hưng, Quận 7, TP.HCM', 'Thể thao', 6, NULL),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Workshop: Nhiếp Ảnh Đường Phố', 'Buổi workshop thực hành cùng nhiếp ảnh gia chuyên nghiệp: cách quan sát ánh sáng, kể chuyện bằng khung hình và hậu kỳ nhanh trên điện thoại.', '/images/events/workshop.jpg', NULL, 'Dreamplex', '195 Điện Biên Phủ, Phường 15, Bình Thạnh, TP.HCM', 'Workshop', 2, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO showtimes (id, name, start_time, end_time, event_id) VALUES
 ('5a000000-0000-4000-8000-000000000001', 'Đêm 1 — 18:00', date_trunc('day', now()) + interval '14 days 18 hours', date_trunc('day', now()) + interval '14 days 18 hours' + interval '3 hours', '55555555-5555-4555-8555-555555555555'),
 ('5a000000-0000-4000-8000-000000000002', 'Đêm 2 — 18:00', date_trunc('day', now()) + interval '15 days 18 hours', date_trunc('day', now()) + interval '15 days 18 hours' + interval '3 hours', '55555555-5555-4555-8555-555555555555'),
 ('6a000000-0000-4000-8000-000000000001', 'Suất 19:30', date_trunc('day', now()) + interval '9 days 19 hours 30 minutes', date_trunc('day', now()) + interval '9 days 19 hours 30 minutes' + interval '3 hours', '66666666-6666-4666-8666-666666666666'),
 ('6a000000-0000-4000-8000-000000000002', 'Suất 19:30 (tuần sau)', date_trunc('day', now()) + interval '10 days 19 hours 30 minutes', date_trunc('day', now()) + interval '10 days 19 hours 30 minutes' + interval '3 hours', '66666666-6666-4666-8666-666666666666'),
 ('7a000000-0000-4000-8000-000000000001', 'Suất 20:00', date_trunc('day', now()) + interval '6 days 20 hours', date_trunc('day', now()) + interval '6 days 20 hours' + interval '3 hours', '77777777-7777-4777-8777-777777777777'),
 ('7a000000-0000-4000-8000-000000000002', 'Suất 20:00 (cuối tuần)', date_trunc('day', now()) + interval '7 days 20 hours', date_trunc('day', now()) + interval '7 days 20 hours' + interval '3 hours', '77777777-7777-4777-8777-777777777777'),
 ('8a000000-0000-4000-8000-000000000001', 'Suất 18:30', date_trunc('day', now()) + interval '4 days 18 hours 30 minutes', date_trunc('day', now()) + interval '4 days 18 hours 30 minutes' + interval '3 hours', '88888888-8888-4888-8888-888888888888'),
 ('8a000000-0000-4000-8000-000000000002', 'Suất 21:00', date_trunc('day', now()) + interval '5 days 21 hours', date_trunc('day', now()) + interval '5 days 21 hours' + interval '3 hours', '88888888-8888-4888-8888-888888888888'),
 ('9a000000-0000-4000-8000-000000000001', 'Trận đấu 19:00', date_trunc('day', now()) + interval '12 days 19 hours', date_trunc('day', now()) + interval '12 days 19 hours' + interval '3 hours', '99999999-9999-4999-8999-999999999999'),
 ('aa000000-0000-4000-8000-000000000001', 'Buổi sáng 09:30', date_trunc('day', now()) + interval '8 days 9 hours 30 minutes', date_trunc('day', now()) + interval '8 days 9 hours 30 minutes' + interval '3 hours', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('aa000000-0000-4000-8000-000000000002', 'Buổi chiều 14:00', date_trunc('day', now()) + interval '8 days 14 hours', date_trunc('day', now()) + interval '8 days 14 hours' + interval '3 hours', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO zones (id, name, matrix_row, matrix_col, showtime_id, position_x, position_y, visual_width, visual_height, price) VALUES
 ('e0000001-0000-4000-8000-000000000001', 'GA Early Bird', 6, 14, '5a000000-0000-4000-8000-000000000001', 90, 30, 720, 150, 650000),
 ('e0000002-0000-4000-8000-000000000002', 'GA Standard', 8, 16, '5a000000-0000-4000-8000-000000000001', 70, 200, 760, 160, 850000),
 ('e0000003-0000-4000-8000-000000000003', 'VIP Front Stage', 4, 10, '5a000000-0000-4000-8000-000000000001', 200, 390, 500, 130, 1500000),
 ('e0000004-0000-4000-8000-000000000004', 'GA Early Bird', 6, 14, '5a000000-0000-4000-8000-000000000002', 90, 30, 720, 150, 650000),
 ('e0000005-0000-4000-8000-000000000005', 'GA Standard', 8, 16, '5a000000-0000-4000-8000-000000000002', 70, 200, 760, 160, 850000),
 ('e0000006-0000-4000-8000-000000000006', 'VIP Front Stage', 4, 10, '5a000000-0000-4000-8000-000000000002', 200, 390, 500, 130, 1500000),
 ('e0000007-0000-4000-8000-000000000007', 'Hạng A', 6, 10, '6a000000-0000-4000-8000-000000000001', 120, 30, 660, 160, 1200000),
 ('e0000008-0000-4000-8000-000000000008', 'Hạng B', 8, 14, '6a000000-0000-4000-8000-000000000001', 80, 210, 740, 170, 800000),
 ('e0000009-0000-4000-8000-000000000009', 'Hạng C', 7, 16, '6a000000-0000-4000-8000-000000000001', 50, 400, 800, 140, 500000),
 ('e000000a-0000-4000-8000-00000000000a', 'Hạng A', 6, 10, '6a000000-0000-4000-8000-000000000002', 120, 30, 660, 160, 1200000),
 ('e000000b-0000-4000-8000-00000000000b', 'Hạng B', 8, 14, '6a000000-0000-4000-8000-000000000002', 80, 210, 740, 170, 800000),
 ('e000000c-0000-4000-8000-00000000000c', 'Hạng C', 7, 16, '6a000000-0000-4000-8000-000000000002', 50, 400, 800, 140, 500000),
 ('e000000d-0000-4000-8000-00000000000d', 'Hạng A', 6, 10, '7a000000-0000-4000-8000-000000000001', 140, 40, 620, 200, 450000),
 ('e000000e-0000-4000-8000-00000000000e', 'Hạng B', 6, 14, '7a000000-0000-4000-8000-000000000001', 80, 270, 740, 200, 300000),
 ('e000000f-0000-4000-8000-00000000000f', 'Hạng A', 6, 10, '7a000000-0000-4000-8000-000000000002', 140, 40, 620, 200, 450000),
 ('e0000010-0000-4000-8000-000000000010', 'Hạng B', 6, 14, '7a000000-0000-4000-8000-000000000002', 80, 270, 740, 200, 300000),
 ('e0000011-0000-4000-8000-000000000011', 'Ghế Thường', 6, 12, '8a000000-0000-4000-8000-000000000001', 120, 40, 660, 210, 120000),
 ('e0000012-0000-4000-8000-000000000012', 'Ghế Đôi', 3, 6, '8a000000-0000-4000-8000-000000000001', 280, 300, 340, 160, 240000),
 ('e0000013-0000-4000-8000-000000000013', 'Ghế Thường', 6, 12, '8a000000-0000-4000-8000-000000000002', 120, 40, 660, 210, 120000),
 ('e0000014-0000-4000-8000-000000000014', 'Ghế Đôi', 3, 6, '8a000000-0000-4000-8000-000000000002', 280, 300, 340, 160, 240000),
 ('e0000015-0000-4000-8000-000000000015', 'Khán đài A', 8, 14, '9a000000-0000-4000-8000-000000000001', 90, 40, 720, 210, 350000),
 ('e0000016-0000-4000-8000-000000000016', 'Khán đài B', 8, 16, '9a000000-0000-4000-8000-000000000001', 70, 290, 760, 220, 200000),
 ('e0000017-0000-4000-8000-000000000017', 'Khu A — bàn trước', 4, 10, 'aa000000-0000-4000-8000-000000000001', 120, 60, 660, 180, 650000),
 ('e0000018-0000-4000-8000-000000000018', 'Khu B', 4, 12, 'aa000000-0000-4000-8000-000000000001', 100, 280, 700, 190, 450000),
 ('e0000019-0000-4000-8000-000000000019', 'Khu A — bàn trước', 4, 10, 'aa000000-0000-4000-8000-000000000002', 120, 60, 660, 180, 650000),
 ('e000001a-0000-4000-8000-00000000001a', 'Khu B', 4, 12, 'aa000000-0000-4000-8000-000000000002', 100, 280, 700, 190, 450000)
ON CONFLICT (id) DO NOTHING;

-- Generate seats for every new zone that does not have any yet.
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
WHERE z.showtime_id IN (
        '5a000000-0000-4000-8000-000000000001',
        '5a000000-0000-4000-8000-000000000002',
        '6a000000-0000-4000-8000-000000000001',
        '6a000000-0000-4000-8000-000000000002',
        '7a000000-0000-4000-8000-000000000001',
        '7a000000-0000-4000-8000-000000000002',
        '8a000000-0000-4000-8000-000000000001',
        '8a000000-0000-4000-8000-000000000002',
        '9a000000-0000-4000-8000-000000000001',
        'aa000000-0000-4000-8000-000000000001',
        'aa000000-0000-4000-8000-000000000002'
      )
  AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.zone_id = z.id);

-- Make the demo maps look lived-in without inventing sales/orders.
UPDATE seats
SET status = 'SOLD'
WHERE zone_id IN (SELECT id FROM zones WHERE showtime_id IN (
        '5a000000-0000-4000-8000-000000000001',
        '5a000000-0000-4000-8000-000000000002',
        '6a000000-0000-4000-8000-000000000001',
        '6a000000-0000-4000-8000-000000000002',
        '7a000000-0000-4000-8000-000000000001',
        '7a000000-0000-4000-8000-000000000002',
        '8a000000-0000-4000-8000-000000000001',
        '8a000000-0000-4000-8000-000000000002',
        '9a000000-0000-4000-8000-000000000001',
        'aa000000-0000-4000-8000-000000000001',
        'aa000000-0000-4000-8000-000000000002'
      ))
  AND ((grid_row * 7 + grid_col * 3) % 11 = 0);

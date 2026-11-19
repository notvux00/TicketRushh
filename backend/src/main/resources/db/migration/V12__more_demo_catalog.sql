-- More demo catalog: 12 events, 24 showtimes, 30 zones, seats and vouchers.
-- Data-only demo migration. Events/showtimes use deterministic ids; zones use
-- gen_random_uuid() and are guarded by (showtime_id, name) existence checks.

INSERT INTO events (id, event_name, description, cover_image, trailer_url, venue_name, venue_address, category, max_tickets_per_order, created_by) VALUES
 ('b1000000-0000-4000-8000-000000000001', 'Đêm Nhạc Trịnh: Còn Mãi Mùa Xuân', 'Đêm nhạc tưởng nhớ Trịnh Công Sơn với dàn nhạc dây, giọng ca khách mời và phần dẫn chuyện về những bản tình ca đi cùng năm tháng.', '/images/events/concert.jpg', NULL, 'Nhà hát Lớn Hà Nội', '1 Tràng Tiền, Hoàn Kiếm, Hà Nội', 'Concert', 4, NULL),
 ('b1000000-0000-4000-8000-000000000002', 'Rock Việt 2026: Bức Tường & Friends', 'Đêm rock hội tụ Bức Tường cùng các ban nhạc khách mời, sân khấu ngoài trời, hệ thống âm thanh lớn và khu merch dành cho fan.', '/images/events/festival.jpg', NULL, 'SECC — Trung tâm Hội chợ & Triển lãm Sài Gòn', '799 Nguyễn Văn Linh, Quận 7, TP.HCM', 'Concert', 6, NULL),
 ('b1000000-0000-4000-8000-000000000003', 'Hài Kịch Đêm Cuối Tuần', 'Chương trình hài kịch tương tác với các nghệ sĩ quen thuộc, gồm nhiều tiểu phẩm ngắn và phần giao lưu cùng khán giả.', '/images/events/comedy.jpg', NULL, 'Nhà hát Bến Thành', 'Mạc Đĩnh Chi, Quận 1, TP.HCM', 'Sân khấu', 4, NULL),
 ('b1000000-0000-4000-8000-000000000004', 'Kịch Thiếu Nhi: Dế Mèn Phiêu Lưu Ký', 'Chuyển thể sân khấu từ tác phẩm quen thuộc, phù hợp trẻ em từ 5 tuổi và gia đình. Có hoạt động chụp hình cùng nhân vật sau suất diễn.', '/images/events/theater.jpg', NULL, 'Sân khấu Idecaf', '28 Lê Thánh Tôn, Quận 1, TP.HCM', 'Sân khấu', 6, NULL),
 ('b1000000-0000-4000-8000-000000000005', 'VBA 2026: Cần Thơ Catfish vs Đà Nẵng Dragons', 'Trận đấu vòng bảng VBA 2026 giữa Cần Thơ Catfish và Đà Nẵng Dragons, có khu cổ động và quà tặng tại cửa vào.', '/images/events/basketball.jpg', NULL, 'Nhà thi đấu CIS', 'Đường số 7, Khu đô thị Phú Mỹ Hưng, Quận 7, TP.HCM', 'Thể thao', 6, NULL),
 ('b1000000-0000-4000-8000-000000000006', 'Bóng Chuyền Quốc Tế: Việt Nam vs Thái Lan', 'Trận giao hữu bóng chuyền nữ quốc tế, mở cửa sớm 60 phút để khán giả ổn định chỗ và tham gia hoạt động bên lề.', '/images/events/sports.jpg', NULL, 'Nhà thi đấu Phú Thọ', '221 Lý Thường Kiệt, Quận 11, TP.HCM', 'Thể thao', 6, NULL),
 ('b1000000-0000-4000-8000-000000000007', 'Liên Hoan Phim Nhật Bản 2026', 'Chuỗi suất chiếu phim Nhật Bản đương đại và kinh điển, có phần giới thiệu ngắn từ ban tuyển chọn trước mỗi phim.', '/images/events/cinema.jpg', NULL, 'BHD Star Cineplex Thảo Điền', 'Tầng 5 Vincom Thảo Điền, TP.HCM', 'Phim', 6, NULL),
 ('b1000000-0000-4000-8000-000000000008', 'Hoàng Tử Bé — Bản 4K', 'Suất chiếu đặc biệt bản phục hồi 4K của phim Hoàng Tử Bé, kèm không gian trưng bày tranh minh họa tại sảnh rạp.', '/images/events/movie.jpg', NULL, 'CGV Vincom Center', '72 Lê Thánh Tôn, Quận 1, TP.HCM', 'Phim', 8, NULL),
 ('b1000000-0000-4000-8000-000000000009', 'Workshop: Viết Content & Kể Chuyện Thương Hiệu', 'Buổi thực hành 3 giờ về cách xây dựng câu chuyện thương hiệu, viết content cho social và bài tập nhóm có phản hồi trực tiếp.', '/images/events/workshop.jpg', NULL, 'Dreamplex', '195 Điện Biên Phủ, Bình Thạnh, TP.HCM', 'Workshop', 2, NULL),
 ('b1000000-0000-4000-8000-00000000000a', 'Workshop: Pha Chế Cà Phê Sáng Tạo', 'Buổi workshop cùng barista chuyên nghiệp: chọn hạt, cân chỉnh công thức và thực hành ba món signature tại quầy.', '/images/events/workshop.jpg', NULL, 'The Workshop Saigon', '27 Ngô Đức Kế, Quận 1, TP.HCM', 'Workshop', 2, NULL),
 ('b1000000-0000-4000-8000-00000000000b', 'Giao Hưởng Nhí: Chuyện Của Những Nốt Nhạc', 'Chương trình hòa nhạc tương tác dành cho trẻ em, giới thiệu các nhạc cụ trong dàn nhạc qua trò chơi và trích đoạn quen thuộc.', '/images/events/orchestra.jpg', NULL, 'Nhà hát Thành phố Hồ Chí Minh', '7 Công trường Lam Sơn, Quận 1, TP.HCM', 'Concert', 4, NULL),
 ('b1000000-0000-4000-8000-00000000000c', 'Đêm Nhạc Acoustic Ven Sông', 'Đêm acoustic ngoài trời bên sông với các ca khúc Việt và quốc tế, khu ngồi thoải mái và food truck từ 17:30.', '/images/events/concert.jpg', NULL, 'Bến Bạch Đằng', 'Đường Tôn Đức Thắng, Quận 1, TP.HCM', 'Concert', 4, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO showtimes (id, name, start_time, end_time, event_id) VALUES
 ('b2000000-0000-4000-8000-000000000001', 'Đêm 1 — 20:00', date_trunc('day', now()) + interval '6 days 20 hours', date_trunc('day', now()) + interval '6 days 23 hours', 'b1000000-0000-4000-8000-000000000001'),
 ('b2000000-0000-4000-8000-000000000002', 'Đêm 2 — 20:00', date_trunc('day', now()) + interval '7 days 20 hours', date_trunc('day', now()) + interval '7 days 23 hours', 'b1000000-0000-4000-8000-000000000001'),
 ('b2000000-0000-4000-8000-000000000003', 'Đêm 1 — 18:30', date_trunc('day', now()) + interval '12 days 18 hours 30 minutes', date_trunc('day', now()) + interval '12 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000002'),
 ('b2000000-0000-4000-8000-000000000004', 'Đêm 2 — 18:30', date_trunc('day', now()) + interval '13 days 18 hours 30 minutes', date_trunc('day', now()) + interval '13 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000002'),
 ('b2000000-0000-4000-8000-000000000005', 'Suất 20:00', date_trunc('day', now()) + interval '4 days 20 hours', date_trunc('day', now()) + interval '4 days 22 hours', 'b1000000-0000-4000-8000-000000000003'),
 ('b2000000-0000-4000-8000-000000000006', 'Suất 20:00 (cuối tuần)', date_trunc('day', now()) + interval '5 days 20 hours', date_trunc('day', now()) + interval '5 days 22 hours', 'b1000000-0000-4000-8000-000000000003'),
 ('b2000000-0000-4000-8000-000000000007', 'Suất 10:00', date_trunc('day', now()) + interval '8 days 10 hours', date_trunc('day', now()) + interval '8 days 12 hours', 'b1000000-0000-4000-8000-000000000004'),
 ('b2000000-0000-4000-8000-000000000008', 'Suất 10:00 (Chủ nhật)', date_trunc('day', now()) + interval '9 days 10 hours', date_trunc('day', now()) + interval '9 days 12 hours', 'b1000000-0000-4000-8000-000000000004'),
 ('b2000000-0000-4000-8000-000000000009', 'Trận đấu 19:00', date_trunc('day', now()) + interval '10 days 19 hours', date_trunc('day', now()) + interval '10 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000005'),
 ('b2000000-0000-4000-8000-00000000000a', 'Trận đấu 19:00 (lượt về)', date_trunc('day', now()) + interval '11 days 19 hours', date_trunc('day', now()) + interval '11 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000005'),
 ('b2000000-0000-4000-8000-00000000000b', 'Trận đấu 19:00', date_trunc('day', now()) + interval '14 days 19 hours', date_trunc('day', now()) + interval '14 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000006'),
 ('b2000000-0000-4000-8000-00000000000c', 'Trận đấu 19:00 (ngày 2)', date_trunc('day', now()) + interval '15 days 19 hours', date_trunc('day', now()) + interval '15 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000006'),
 ('b2000000-0000-4000-8000-00000000000d', 'Suất 18:00', date_trunc('day', now()) + interval '3 days 18 hours', date_trunc('day', now()) + interval '3 days 20 hours', 'b1000000-0000-4000-8000-000000000007'),
 ('b2000000-0000-4000-8000-00000000000e', 'Suất 18:00 (ngày 2)', date_trunc('day', now()) + interval '4 days 18 hours', date_trunc('day', now()) + interval '4 days 20 hours', 'b1000000-0000-4000-8000-000000000007'),
 ('b2000000-0000-4000-8000-00000000000f', 'Suất 19:30', date_trunc('day', now()) + interval '2 days 19 hours 30 minutes', date_trunc('day', now()) + interval '2 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000008'),
 ('b2000000-0000-4000-8000-000000000010', 'Suất 19:30 (ngày 2)', date_trunc('day', now()) + interval '3 days 19 hours 30 minutes', date_trunc('day', now()) + interval '3 days 21 hours 30 minutes', 'b1000000-0000-4000-8000-000000000008'),
 ('b2000000-0000-4000-8000-000000000011', 'Buổi sáng 09:30', date_trunc('day', now()) + interval '7 days 9 hours 30 minutes', date_trunc('day', now()) + interval '7 days 12 hours 30 minutes', 'b1000000-0000-4000-8000-000000000009'),
 ('b2000000-0000-4000-8000-000000000012', 'Buổi sáng 09:30 (ngày 2)', date_trunc('day', now()) + interval '8 days 9 hours 30 minutes', date_trunc('day', now()) + interval '8 days 12 hours 30 minutes', 'b1000000-0000-4000-8000-000000000009'),
 ('b2000000-0000-4000-8000-000000000013', 'Buổi chiều 14:00', date_trunc('day', now()) + interval '9 days 14 hours', date_trunc('day', now()) + interval '9 days 17 hours', 'b1000000-0000-4000-8000-00000000000a'),
 ('b2000000-0000-4000-8000-000000000014', 'Buổi chiều 14:00 (ngày 2)', date_trunc('day', now()) + interval '10 days 14 hours', date_trunc('day', now()) + interval '10 days 17 hours', 'b1000000-0000-4000-8000-00000000000a'),
 ('b2000000-0000-4000-8000-000000000015', 'Suất 16:00', date_trunc('day', now()) + interval '5 days 16 hours', date_trunc('day', now()) + interval '5 days 18 hours', 'b1000000-0000-4000-8000-00000000000b'),
 ('b2000000-0000-4000-8000-000000000016', 'Suất 16:00 (Chủ nhật)', date_trunc('day', now()) + interval '6 days 16 hours', date_trunc('day', now()) + interval '6 days 18 hours', 'b1000000-0000-4000-8000-00000000000b'),
 ('b2000000-0000-4000-8000-000000000017', 'Đêm 1 — 19:30', date_trunc('day', now()) + interval '11 days 19 hours 30 minutes', date_trunc('day', now()) + interval '11 days 22 hours', 'b1000000-0000-4000-8000-00000000000c'),
 ('b2000000-0000-4000-8000-000000000018', 'Đêm 2 — 19:30', date_trunc('day', now()) + interval '12 days 19 hours 30 minutes', date_trunc('day', now()) + interval '12 days 22 hours', 'b1000000-0000-4000-8000-00000000000c')
ON CONFLICT (id) DO NOTHING;

INSERT INTO zones (id, name, matrix_row, matrix_col, showtime_id, position_x, position_y, visual_width, visual_height, price)
SELECT gen_random_uuid(), v.name, v.matrix_row, v.matrix_col, v.showtime_id::uuid,
       v.position_x, v.position_y, v.visual_width, v.visual_height, v.price
FROM (VALUES
 ('b2000000-0000-4000-8000-000000000001', 'VIP', 4, 10, 280, 40, 340, 140, 1800000::double precision),
 ('b2000000-0000-4000-8000-000000000001', 'GA', 6, 14, 120, 210, 660, 180, 1200000::double precision),
 ('b2000000-0000-4000-8000-000000000001', 'Balcony', 7, 16, 70, 410, 760, 130, 800000::double precision),
 ('b2000000-0000-4000-8000-000000000002', 'VIP', 4, 10, 280, 40, 340, 140, 1800000::double precision),
 ('b2000000-0000-4000-8000-000000000002', 'GA', 6, 14, 120, 210, 660, 180, 1200000::double precision),
 ('b2000000-0000-4000-8000-000000000002', 'Balcony', 7, 16, 70, 410, 760, 130, 800000::double precision),
 ('b2000000-0000-4000-8000-000000000003', 'VIP', 4, 10, 280, 40, 340, 140, 1500000::double precision),
 ('b2000000-0000-4000-8000-000000000003', 'GA', 6, 14, 120, 210, 660, 180, 900000::double precision),
 ('b2000000-0000-4000-8000-000000000003', 'Balcony', 7, 16, 70, 410, 760, 130, 600000::double precision),
 ('b2000000-0000-4000-8000-000000000004', 'VIP', 4, 10, 280, 40, 340, 140, 1500000::double precision),
 ('b2000000-0000-4000-8000-000000000004', 'GA', 6, 14, 120, 210, 660, 180, 900000::double precision),
 ('b2000000-0000-4000-8000-000000000004', 'Balcony', 7, 16, 70, 410, 760, 130, 600000::double precision),
 ('b2000000-0000-4000-8000-000000000005', 'Hạng A', 6, 10, 140, 40, 620, 200, 450000::double precision),
 ('b2000000-0000-4000-8000-000000000005', 'Hạng B', 6, 14, 80, 270, 740, 200, 350000::double precision),
 ('b2000000-0000-4000-8000-000000000006', 'Hạng A', 6, 10, 140, 40, 620, 200, 450000::double precision),
 ('b2000000-0000-4000-8000-000000000006', 'Hạng B', 6, 14, 80, 270, 740, 200, 350000::double precision),
 ('b2000000-0000-4000-8000-000000000007', 'Hạng A', 6, 10, 140, 40, 620, 200, 350000::double precision),
 ('b2000000-0000-4000-8000-000000000007', 'Hạng B', 6, 14, 80, 270, 740, 200, 250000::double precision),
 ('b2000000-0000-4000-8000-000000000008', 'Hạng A', 6, 10, 140, 40, 620, 200, 350000::double precision),
 ('b2000000-0000-4000-8000-000000000008', 'Hạng B', 6, 14, 80, 270, 740, 200, 250000::double precision),
 ('b2000000-0000-4000-8000-000000000009', 'Khán đài A', 8, 14, 90, 40, 720, 200, 500000::double precision),
 ('b2000000-0000-4000-8000-000000000009', 'Khán đài B', 8, 16, 70, 270, 760, 220, 300000::double precision),
 ('b2000000-0000-4000-8000-000000000009', 'Khán đài C', 6, 18, 40, 500, 820, 100, 200000::double precision),
 ('b2000000-0000-4000-8000-00000000000a', 'Khán đài A', 8, 14, 90, 40, 720, 200, 500000::double precision),
 ('b2000000-0000-4000-8000-00000000000a', 'Khán đài B', 8, 16, 70, 270, 760, 220, 300000::double precision),
 ('b2000000-0000-4000-8000-00000000000a', 'Khán đài C', 6, 18, 40, 500, 820, 100, 200000::double precision),
 ('b2000000-0000-4000-8000-00000000000b', 'Khán đài A', 8, 14, 90, 40, 720, 200, 600000::double precision),
 ('b2000000-0000-4000-8000-00000000000b', 'Khán đài B', 8, 16, 70, 270, 760, 220, 400000::double precision),
 ('b2000000-0000-4000-8000-00000000000b', 'Khán đài C', 6, 18, 40, 500, 820, 100, 250000::double precision),
 ('b2000000-0000-4000-8000-00000000000c', 'Khán đài A', 8, 14, 90, 40, 720, 200, 600000::double precision),
 ('b2000000-0000-4000-8000-00000000000c', 'Khán đài B', 8, 16, 70, 270, 760, 220, 400000::double precision),
 ('b2000000-0000-4000-8000-00000000000c', 'Khán đài C', 6, 18, 40, 500, 820, 100, 250000::double precision),
 ('b2000000-0000-4000-8000-00000000000d', 'Ghế Thường', 6, 12, 120, 40, 660, 210, 180000::double precision),
 ('b2000000-0000-4000-8000-00000000000d', 'Ghế Đôi', 3, 6, 280, 300, 340, 160, 360000::double precision),
 ('b2000000-0000-4000-8000-00000000000e', 'Ghế Thường', 6, 12, 120, 40, 660, 210, 180000::double precision),
 ('b2000000-0000-4000-8000-00000000000e', 'Ghế Đôi', 3, 6, 280, 300, 340, 160, 360000::double precision),
 ('b2000000-0000-4000-8000-00000000000f', 'Ghế Thường', 6, 12, 120, 40, 660, 210, 150000::double precision),
 ('b2000000-0000-4000-8000-00000000000f', 'Ghế Đôi', 3, 6, 280, 300, 340, 160, 300000::double precision),
 ('b2000000-0000-4000-8000-000000000010', 'Ghế Thường', 6, 12, 120, 40, 660, 210, 150000::double precision),
 ('b2000000-0000-4000-8000-000000000010', 'Ghế Đôi', 3, 6, 280, 300, 340, 160, 300000::double precision),
 ('b2000000-0000-4000-8000-000000000011', 'Standard', 4, 12, 100, 60, 700, 190, 500000::double precision),
 ('b2000000-0000-4000-8000-000000000011', 'Premium', 4, 10, 120, 300, 660, 180, 800000::double precision),
 ('b2000000-0000-4000-8000-000000000012', 'Standard', 4, 12, 100, 60, 700, 190, 500000::double precision),
 ('b2000000-0000-4000-8000-000000000012', 'Premium', 4, 10, 120, 300, 660, 180, 800000::double precision),
 ('b2000000-0000-4000-8000-000000000013', 'Standard', 4, 12, 100, 60, 700, 190, 650000::double precision),
 ('b2000000-0000-4000-8000-000000000013', 'Premium', 4, 10, 120, 300, 660, 180, 950000::double precision),
 ('b2000000-0000-4000-8000-000000000014', 'Standard', 4, 12, 100, 60, 700, 190, 650000::double precision),
 ('b2000000-0000-4000-8000-000000000014', 'Premium', 4, 10, 120, 300, 660, 180, 950000::double precision),
 ('b2000000-0000-4000-8000-000000000015', 'Hạng A', 6, 10, 140, 40, 620, 200, 400000::double precision),
 ('b2000000-0000-4000-8000-000000000015', 'Hạng B', 6, 14, 80, 270, 740, 200, 300000::double precision),
 ('b2000000-0000-4000-8000-000000000016', 'Hạng A', 6, 10, 140, 40, 620, 200, 400000::double precision),
 ('b2000000-0000-4000-8000-000000000016', 'Hạng B', 6, 14, 80, 270, 740, 200, 300000::double precision),
 ('b2000000-0000-4000-8000-000000000017', 'Hạng A', 6, 10, 140, 40, 620, 200, 550000::double precision),
 ('b2000000-0000-4000-8000-000000000017', 'Hạng B', 6, 14, 80, 270, 740, 200, 450000::double precision),
 ('b2000000-0000-4000-8000-000000000018', 'Hạng A', 6, 10, 140, 40, 620, 200, 550000::double precision),
 ('b2000000-0000-4000-8000-000000000018', 'Hạng B', 6, 14, 80, 270, 740, 200, 450000::double precision)
) AS v(showtime_id, name, matrix_row, matrix_col, position_x, position_y, visual_width, visual_height, price)
WHERE NOT EXISTS (
  SELECT 1 FROM zones z WHERE z.showtime_id = v.showtime_id::uuid AND z.name = v.name
);

INSERT INTO seats (id, seat_label, status, grid_row, grid_col, zone_id)
SELECT gen_random_uuid(), chr(64 + r) || c, 'AVAILABLE', r, c, z.id
FROM zones z
CROSS JOIN generate_series(1, z.matrix_row) AS r
CROSS JOIN generate_series(1, z.matrix_col) AS c
WHERE z.showtime_id IN (
        'b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002',
        'b2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000004',
        'b2000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000006',
        'b2000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000008',
        'b2000000-0000-4000-8000-000000000009', 'b2000000-0000-4000-8000-00000000000a',
        'b2000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-00000000000c',
        'b2000000-0000-4000-8000-00000000000d', 'b2000000-0000-4000-8000-00000000000e',
        'b2000000-0000-4000-8000-00000000000f', 'b2000000-0000-4000-8000-000000000010',
        'b2000000-0000-4000-8000-000000000011', 'b2000000-0000-4000-8000-000000000012',
        'b2000000-0000-4000-8000-000000000013', 'b2000000-0000-4000-8000-000000000014',
        'b2000000-0000-4000-8000-000000000015', 'b2000000-0000-4000-8000-000000000016',
        'b2000000-0000-4000-8000-000000000017', 'b2000000-0000-4000-8000-000000000018'
      )
  AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.zone_id = z.id);

-- A believable amount of sold seats, without inventing paid orders.
UPDATE seats
SET status = 'SOLD'
WHERE zone_id IN (
        SELECT id FROM zones WHERE showtime_id IN (
          'b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002',
          'b2000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000004',
          'b2000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000006',
          'b2000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000008',
          'b2000000-0000-4000-8000-000000000009', 'b2000000-0000-4000-8000-00000000000a',
          'b2000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-00000000000c',
          'b2000000-0000-4000-8000-00000000000d', 'b2000000-0000-4000-8000-00000000000e',
          'b2000000-0000-4000-8000-00000000000f', 'b2000000-0000-4000-8000-000000000010',
          'b2000000-0000-4000-8000-000000000011', 'b2000000-0000-4000-8000-000000000012',
          'b2000000-0000-4000-8000-000000000013', 'b2000000-0000-4000-8000-000000000014',
          'b2000000-0000-4000-8000-000000000015', 'b2000000-0000-4000-8000-000000000016',
          'b2000000-0000-4000-8000-000000000017', 'b2000000-0000-4000-8000-000000000018'
        )
      )
  AND ((grid_row * 5 + grid_col * 7) % 9 = 0);

INSERT INTO vouchers (id, code, description, discount_type, discount_value, max_discount, min_order_price, total_quantity, used_quantity, start_date, end_date, active, event_id) VALUES
 ('d1000000-0000-4000-8000-000000000001', 'RUSH20', 'Giảm 20% tối đa 300.000 đ cho đơn từ 200.000 đ', 'PERCENTAGE', 20, 300000, 200000, 500, 0, now() - interval '1 day', now() + interval '6 months', true, NULL),
 ('d1000000-0000-4000-8000-000000000002', 'WELCOME150', 'Giảm 150.000 đ cho khách mới, đơn từ 500.000 đ', 'FIXED_AMOUNT', 150000, NULL, 500000, 300, 0, now() - interval '1 day', now() + interval '3 months', true, NULL),
 ('d1000000-0000-4000-8000-000000000003', 'SV50', 'Ưu đãi sinh viên: giảm 50.000 đ cho đơn từ 150.000 đ', 'FIXED_AMOUNT', 50000, NULL, 150000, 1000, 0, now() - interval '1 day', now() + interval '6 months', true, NULL),
 ('d1000000-0000-4000-8000-000000000004', 'COMBO100', 'Giảm 100.000 đ khi mua từ 2 vé', 'FIXED_AMOUNT', 100000, NULL, 300000, 400, 0, now() - interval '1 day', now() + interval '4 months', true, NULL),
 ('d1000000-0000-4000-8000-000000000005', 'WEEKEND15', 'Giảm 15% tối đa 250.000 đ cho đơn cuối tuần', 'PERCENTAGE', 15, 250000, 400000, 600, 0, now() - interval '1 day', now() + interval '6 months', true, NULL),
 ('d1000000-0000-4000-8000-000000000006', 'VIP200', 'Giảm 200.000 đ cho đơn từ 1.500.000 đ', 'FIXED_AMOUNT', 200000, NULL, 1500000, 150, 0, now() - interval '1 day', now() + interval '6 months', true, NULL)
ON CONFLICT (code) DO NOTHING;

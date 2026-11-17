# Kiến trúc và chức năng hiện tại

## Thành phần và luồng dữ liệu

Frontend React gọi API cùng origin; local Vite proxy /api và /ws về Spring Boot. AWS CloudFront route /api/* và /ws* tới ALB, static frontend và /media/* tới S3 private qua OAC. EC2 private dùng PostgreSQL/Redis; Secrets Manager và SSM cung cấp cấu hình khi boot. Xem [Terraform](../infra/terraform/README.md) và [triển khai](AWS_DEPLOY.md).

Backend dùng JWT role/ownership. Các API /api/admin/** yêu cầu ADMIN; /api/checkin/** cho ADMIN hoặc STAFF. Giao diện admin hiện dành cho ADMIN. Session được lưu atomically trong ticketrush.session, đồng bộ giữa tab và chặn request từ giao diện chưa đổi sang đúng tài khoản.

## Booking, queue và vé

1. Queue/status hoặc service booking cấp pass/lease bằng Lua khi được admission. Threshold, hard capacity và waiting users được kiểm tra cùng thao tác ghi slot; người đang giữ pass không bị đếm hai lần.
2. Chọn ghế là draft phía browser, namespace theo owner/showtime và revision. Checkout ghi bản khôi phục theo orderId; xử lý đơn cũ không xóa bản của đơn mới.
3. Checkout khóa DB seats theo thứ tự và giữ Redis locks all-or-none. Giá từng ticket được snapshot; giới hạn vé và showtime membership được kiểm tra ở service.
4. Phiên có hạn tối đa 10 phút và không vượt giờ bắt đầu suất. Confirm/cancel/expiry đồng bộ trạng thái order, tickets và release admission. PostgreSQL bảo vệ issued tickets và checkout còn sống khỏi xóa sai.
5. Thanh toán hiện là giả lập: nút xác nhận hoàn tất đơn, chưa có payment gateway hay xác thực chuyển khoản.
6. Ticket QR dùng HMAC, payload TKRUSH:v1:<ticketId>:<seatId>:<signature>. Chỉ đơn COMPLETED được dùng check-in; khóa ticket khi quét ngăn cùng vé vào hai lần.

Queue dùng queue:leases:<showtime> và pass keys có TTL; counter là dữ liệu dẫn xuất. Bootstrap, deadline, drift và membership bất thường kích hoạt đối soát atomically. Redis expiry notification chỉ hỗ trợ cập nhật sớm. Không sửa counter bằng DECR thủ công. Scheduler dùng ShedLock; realtime được relay qua ticketrush:ws đến mọi instance. Client chỉ subscribe, không tự publish seat/queue events.

## Admin dashboard

Route /admin gọi GET /api/admin/overview, refresh mỗi 30 giây:

- totalRevenue từ orders COMPLETED, mỗi order chỉ tính một lần dù có nhiều tickets.
- totalTicketsSold từ tickets của đơn COMPLETED; totalUsers chỉ role USER.
- totalEvents, activeVouchers (số voucher đang bật).
- topEvents tối đa 3, theo doanh thu rồi vé bán, có sold/total seats và occupancy.
- voucherSummary tính usageCount/totalSaved từ đơn COMPLETED.
- recentOrders tối đa 5, không lặp theo số ghế.

Các tổng hợp trong một lần đọc dùng transaction REPEATABLE_READ. Danh sách rỗng, lỗi tải và làm mới đều có trạng thái giao diện.

## Voucher admin

Route /admin/vouchers:

| API | Hành vi |
| --- | --- |
| GET /api/admin/vouchers | Danh sách, audit fields, usageCount, totalSaved và canDelete |
| POST /api/admin/vouchers | Tạo mới, trả 201; trùng code trả 409 |
| PATCH /api/admin/vouchers/{id}/toggle | Bật/tắt, khóa row khi thay đổi |
| DELETE /api/admin/vouchers/{id} | 204 nếu chưa dùng và chưa gắn order; 409 nếu cần giữ lịch sử |

Request: code 4–20 ký tự A–Z/0–9; discountType FIXED_AMOUNT/PERCENTAGE (chấp nhận alias FIXED/PERCENT); discountValue hữu hạn và dương, percentage <=100. Có description tối đa 255 ký tự, expiresAt tương lai, maxUsage >=1 hoặc null không giới hạn, maxDiscount, minOrderPrice và eventId tùy chọn.

UI nhập giờ Việt Nam, gửi offset +07:00. API dùng lại end_date/total_quantity của schema; không tạo cột expiry/quota trùng. Tạo mới lưu created_at/created_by. Voucher đã gắn bất kỳ order nào hoặc có usage không xóa được; tắt thay vì xóa. Voucher tắt không xuất hiện trong danh sách checkout và không thể consume khi confirm. Seed mặc định được tạo nếu thiếu lúc khởi động backend.

## Scanner tại cổng

Route /admin/checkin chọn suất và tên cổng trước khi bật camera hoặc nhập payload.

- Camera dùng getUserMedia, ưu tiên camera sau và jsQR; cần HTTPS/localhost và quyền camera.
- Request gửi tuần tự, chặn cùng mã trong 2 giây; camera tracks được dừng khi rời trang/tắt camera.
- POST /api/checkin/scan nhận qrPayload, gateName, deviceId và showtimeId tùy chọn. UI luôn gửi showtimeId đã chọn; sai suất trả WRONG_SHOWTIME và không tiêu thụ vé.
- Kết quả phân biệt hợp lệ, đã dùng, QR sai, sai suất, đơn chưa hoàn tất và lỗi kết nối. Lỗi mạng không được trình bày như check-in thành công.
- GET /api/admin/checkin/stats/{showtimeId}: totalTickets, checkedIn, pendingEntry, checkInRate; chỉ tính đơn COMPLETED. UI refresh 5 giây/lần và sau scan.
- UI giữ 10 lượt gần nhất trong phiên của trang; audit bền vững nằm trong ticket_checkins.

Không cam kết độ trễ dưới 1 giây với mọi camera/network. Đã kiểm tra camera permission/lifecycle bằng mock browser; chưa nghiệm thu camera vật lý hoặc Safari/iPhone. Chức năng nhập mã có thể dùng để kiểm tra API khi camera không khả dụng.

## Schema và maintenance

Flyway quản lý V1–V8, Hibernate validate. V7 bảo vệ issued history ngay và kiểm tra xóa checkout sống tại commit để tương thích cancel cũ. V8 thêm voucher audit và cho phép total_quantity=null; created_at của voucher legacy được backfill theo thời điểm migration, không khẳng định là giờ tạo lịch sử.

Maintenance worker Python 3.12/x86_64 chạy 15 phút/lần trong AWS demo. Cùng một transaction: expire PENDING quá hạn, reap LOCKED quá 15 phút và tắt voucher hết hạn/hết quota. Không xóa draft tickets. Có TLS, secret lookup, statement/lock timeout và concurrency=1. [Hướng dẫn worker](../infra/lambda/maintenance/README.md).

## Xác minh tính năng và giới hạn

Kết quả local ngày 2026-11-17 được tổng hợp tại đây thay cho các báo cáo review/spec đã hoàn tất:

| Nhóm | Kết quả |
| --- | --- |
| Backend PostgreSQL/Redis, nâng cấp V6 lên V8 | 64 tests pass, không failure/error/skip |
| Playwright session/checkout/admin, DOM/network | 16 tests pass |
| Node regression | 15 tests pass |
| Deployment/infrastructure Python contracts | 12 tests pass |
| Frontend lint/build | Pass, còn 4 hooks warnings cũ và cảnh báo bundle |
| npm audit | 0 vulnerabilities tại thời điểm kiểm tra |
| Impeccable mechanical detector trên UI mới | Không có finding |

Các test mới kiểm tra revenue không nhân theo số ghế; voucher validation/quyền/usage/delete history; wrong-showtime không consume vé; stats bỏ draft; admin navigation trên mobile; camera refusal, cleanup và debounce. Chỉ kiểm tra DOM/network, không screenshot hoặc đọc ảnh. Test camera không truy cập camera thật.

Chưa deploy/apply AWS, STS/ECR/failover hoặc load test lớn. Tài liệu triển khai nêu điều kiện cần; validation local không bảo đảm quota, DNS, IAM thực tế. Phiên này không commit/push.

# Kịch bản demo

Dùng dữ liệu thử trong môi trường local/demo đã chuẩn bị. Thanh toán là giả lập. Không trình bày các cờ tính năng chưa có tài nguyên Terraform như dịch vụ đã chạy.

## Kiến trúc

Dùng [ARCHITECTURE](ARCHITECTURE.md) và sơ đồ demo: CloudFront/S3, ALB public có origin header, EC2 private trên 2 AZ, PostgreSQL/Redis, Redis relay và maintenance Lambda. Profile prod có ALB private/VPC Origin, WAF, RDS Proxy; không suy ra demo có các dịch vụ đó.

## Admin

1. Đăng nhập tài khoản admin đã cấu hình; /admin hiển thị doanh thu, vé bán, user, top events và đơn gần nhất từ API.
2. /admin/add-event: tạo suất tương lai, zone/ghế, upload media qua presigned PUT.
3. /admin/vouchers: tạo mã mới, kiểm tra hạn/quota, bật/tắt. Voucher gắn đơn không xóa được.

## Đặt vé và soát vé

1. Browser khác đăng ký USER, chọn ghế, sang checkout; browser còn lại nhận update realtime.
2. Áp dụng voucher, xác nhận thanh toán giả lập, mở Vé của tôi.
3. Admin chọn đúng suất ở /admin/checkin, quét camera hoặc nhập payload. Lần đầu thành công; lần sau báo đã dùng. Vé sai suất không bị tiêu thụ.
4. Dashboard và stats check-in cập nhật sau thao tác; không dùng con số demo hardcode.

## Queue và worker

Admin đặt threshold thấp, simulate users; người dùng thấy waiting room và được scheduler cấp pass. Giải thích direct booking API cũng qua admission. Không sửa counter Redis bằng tay để demo.

Invoke worker sau khi chuẩn bị fixture quá hạn; xem ba số row trong logs. Worker không xóa draft tickets, không tự xác nhận thanh toán.

## Scaling và alarm

```bash
k6 run -e BASE_URL=https://ticketrush.sudothanh.me tests/load/k6.js
```

Script chỉ tải GET status/events; có thể chưa đủ đẩy CPU/5xx tới ngưỡng. Trình bày metric thực tế; không cam kết scale hoặc alarm chỉ vì đã chạy k6. Chỉ chạy với quyền và ngân sách phù hợp.

Kết thúc: lưu dữ liệu cần giữ, chạy quy trình [destroy demo](RUNBOOK.md).

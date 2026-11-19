# TicketRush

Ứng dụng đặt vé sự kiện với Spring Boot, React, PostgreSQL và Redis. Bản demo đã triển khai trên AWS tại **https://ticketrush.sudothanh.me**; hạ tầng được quản lý bằng Terraform.

## Chức năng

- Đăng ký/đăng nhập JWT, hồ sơ và vé của tôi.
- Chọn ghế, giữ ghế bằng Redis Lua, checkout có thời hạn, voucher và QR có chữ ký.
- Queue admission dùng lease, có đối soát sau khi mất notification/restart.
- Admin: tổng quan dữ liệu thật, quản lý sự kiện, tạo/bật/tắt/xóa voucher chưa dùng và soát vé bằng camera hoặc nhập QR.
- Maintenance worker chạy mỗi 15 phút trong profile AWS demo.

Thanh toán hiện là **giả lập**, chưa tích hợp cổng thanh toán hoặc xác nhận chuyển khoản thật. Admin scanner yêu cầu HTTPS hoặc localhost để dùng camera.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS, TanStack Query, jsQR |
| Backend | Java 17, Spring Boot 3.5, Spring Security/JWT |
| Dữ liệu | PostgreSQL 16, Flyway V1–V8, Redis 7 |
| Realtime | Native STOMP WebSocket + Redis Pub/Sub |
| Media | S3/CloudFront OAC; local dùng Adobe S3Mock |
| Triển khai | Terraform, GitHub Actions OIDC, EC2/ASG/ALB, RDS/ElastiCache, Lambda |

## Chạy local

Cần Docker Compose và Node >=22.12. Backend có thể build trong Docker hoặc chạy với JDK 17.

```bash
cp .env.example .env
cp frontend/.env-example.txt frontend/.env
docker compose up -d postgres redis s3mock
docker compose --profile app run --rm --no-deps frontend npm ci
docker compose --profile app up --build
```

Mở http://localhost:5173. Admin local theo file mẫu: `admin@gmail.com / admin123`; thay thông tin này trước khi public. Xem [LOCAL_DEV](docs/LOCAL_DEV.md) nếu chạy app ngoài Docker.

## Tài liệu

- [Mục lục](docs/README.md)
- [Kiến trúc và API hiện có](docs/ARCHITECTURE.md)
- [Local development và kiểm thử](docs/LOCAL_DEV.md)
- [Triển khai AWS demo](docs/AWS_DEPLOY.md)
- [Runbook và thu hồi tài nguyên](docs/RUNBOOK.md)
- [Kịch bản demo](docs/DEMO_SCRIPT.md)
- [Lập dự toán chi phí](docs/COST.md)
- [Terraform](infra/terraform/README.md)
- [Maintenance worker](infra/lambda/maintenance/README.md)

Các spec đã triển khai và báo cáo review lịch sử đã được thay bằng tài liệu trạng thái hiện tại. Không sửa migration đã áp dụng; thêm migration mới khi đổi schema.

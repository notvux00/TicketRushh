# Local development

## Yêu cầu

Docker Compose; Node >=22.12 cho frontend. Chạy backend ngoài Docker cần JDK 17. Các lệnh Bash dùng `./mvnw`; PowerShell dùng `.\\mvnw.cmd`.

## Docker Compose

Chạy từ thư mục gốc:

```bash
cp .env.example .env
cp frontend/.env-example.txt frontend/.env
docker compose up -d postgres redis s3mock
docker compose --profile app run --rm --no-deps frontend npm ci
docker compose --profile app up --build
```

Lệnh npm ci cài dependency vào volume frontend trước lần khởi động đầu, và chạy lại khi lockfile đổi.

| Dịch vụ | Địa chỉ |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend readiness | http://localhost:8080/actuator/health/readiness |
| PostgreSQL | localhost:5432, DB ticketrush, postgres/postgres |
| Redis | localhost:6379, expiry notifications Ex |
| Adobe S3Mock | http://localhost:9090, bucket ticketrush-media |

Admin local đọc ADMIN_EMAIL/ADMIN_PASSWORD từ .env; mẫu là admin@gmail.com/admin123. Không dùng tài khoản mẫu khi public.

## Chạy app ngoài Docker

Giữ PostgreSQL/Redis/S3Mock trong Compose. Backend đọc .env theo working directory; đặt biến môi trường trong shell hoặc tạo backend/.env, không commit secret.

```powershell
$env:APP_BOOTSTRAP_ADMIN = "true"
$env:ADMIN_EMAIL = "admin@gmail.com"
$env:ADMIN_PASSWORD = "admin123"
$env:JWT_SECRET = "replace-with-a-random-secret-at-least-32-bytes"
$env:TICKET_SIGNING_SECRET = "replace-with-a-different-random-secret-at-least-32-bytes"
$env:MEDIA_ENDPOINT = "http://localhost:9090"
$env:MEDIA_PUBLIC_ENDPOINT = "http://localhost:9090"
$env:MEDIA_PUBLIC_BASE_URL = "http://localhost:9090/ticketrush-media"
$env:MEDIA_PATH_STYLE = "true"
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
cd backend
.\\mvnw.cmd spring-boot:run
```

Trong terminal khác, chạy npm ci và npm run dev tại frontend. Vite proxy /api và /ws về localhost:8080. Khi chạy frontend ngoài Compose, đặt VITE_MEDIA_BASE_URL=http://localhost:9090/ticketrush-media trong frontend/.env.

## Biến môi trường

| Biến | Công dụng |
| --- | --- |
| DB_URL, DB_USERNAME, DB_PASSWORD | PostgreSQL |
| REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_SSL | Redis; ElastiCache dùng TLS |
| JWT_SECRET | Ký JWT; bắt buộc, >= 32 byte, cần giữ ổn định giữa instance/restart |
| TICKET_SIGNING_SECRET | Ký QR vé; bắt buộc, >= 32 byte và phải khác JWT_SECRET. Rotate sẽ làm QR cũ không còn hợp lệ |
| TICKET_SIGNING_KEY_VERSION | Phiên bản khoá ký vé, mặc định 1; tăng khi chủ động rotate và chấp nhận reissue vé |
| MEDIA_BUCKET, MEDIA_REGION | S3 bucket/region |
| MEDIA_ENDPOINT, MEDIA_PUBLIC_ENDPOINT, MEDIA_PATH_STYLE | Local S3-compatible endpoint |
| MEDIA_PUBLIC_BASE_URL | Local URL ở trên; AWS dùng URL CloudFront do Terraform truyền |
| APP_SEED_DEMO_DATA | `true` chỉ ở local/demo để tạo voucher mẫu; mặc định `false` |
| MAX_SEATS_PER_ZONE, MAX_SEATS_PER_REQUEST | Giới hạn sinh ghế khi tạo zone/event (mặc định 5000 và 100000) |
| APP_BOOTSTRAP_ADMIN, ADMIN_EMAIL, ADMIN_PASSWORD | Bootstrap admin |
| ADMIN_RESET_PASSWORD | Chỉ bật khi chủ động reset mật khẩu admin |
| CORS_ALLOWED_ORIGINS, WS_ALLOWED_ORIGINS | Danh sách origin frontend |

## Kiểm thử

Từ thư mục gốc, chạy từng nhóm trong thư mục được chỉ định:

```bash
(cd backend && ./mvnw -B verify)
(cd frontend && npm ci && npm run lint && npm run build)
(cd frontend && npx playwright install chromium && npm run test:browser)
node --test tests/*.test.cjs
python -m unittest discover -s tests -p 'test_*.py' -v
```

Backend integration dùng Testcontainers, cần Docker. Playwright dùng server riêng port 18088; không chạy dev/preview khác trên port đó. Có thể đặt PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH nếu đã có Chromium. Kiểm tra browser dùng DOM/network, screenshot/video/trace tắt.

Test worker cần dependency host và MAINTENANCE_TEST_DSN: xem [worker README](../infra/lambda/maintenance/README.md). Test schema upgrade kiểm tra cả DB cũ và nâng cấp lên migration hiện tại.

## Kiểm tra chức năng

- Vào /admin để xem dashboard, /admin/vouchers để quản lý ưu đãi.
- /admin/checkin: chọn suất, bật camera hoặc nhập payload. Camera thật cần cấp quyền; nhập mã vẫn hoạt động khi từ chối camera.
- Hai backend cùng DB/Redis, ports 8080/8081: client STOMP ở một backend nhận update ghế do backend còn lại phát.
- API /api/status chỉ chứng minh app trả lời; readiness kiểm tra DB, không chứng minh Redis đang khỏe.

## Reset dữ liệu

docker compose down -v xóa toàn bộ dữ liệu local trong volume. Chỉ dùng khi không cần dữ liệu đó. Sau khi tạo lại hạ tầng và start backend, Flyway áp dụng V1–V8.

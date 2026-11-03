# Local development

## 1. Chuẩn bị

```bash
cp .env.example .env
cp frontend/.env-example.txt frontend/.env
```

`.env` và `frontend/.env` đã nằm trong `.gitignore`.

## 2. Chạy hạ tầng

```bash
docker compose up -d postgres redis s3mock
```

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- S3Mock: `localhost:9090` (S3 API), bucket `ticketrush-media`

S3Mock thay cho MinIO vì registry hiện tại không tải được image MinIO. API tương thích S3 và hỗ trợ presigned PUT + CORS.

## 3. Chạy app

```bash
docker compose --profile app up --build
```

Hoặc chạy riêng:

```bash
cd backend && ./mvnw spring-boot:run
cd frontend && npm ci && npm run dev
```

## 4. Biến môi trường quan trọng

| Biến | Ý nghĩa |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL` | Redis/ElastiCache |
| `JWT_SECRET` | Phải đủ mạnh khi deploy |
| `MEDIA_BUCKET`, `MEDIA_REGION` | S3 bucket |
| `MEDIA_ENDPOINT`, `MEDIA_PUBLIC_ENDPOINT` | Chỉ dùng local |
| `MEDIA_PUBLIC_BASE_URL` | Local: `http://localhost:9090/ticketrush-media`; production để trống |
| `APP_BOOTSTRAP_ADMIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tạo/promote admin local |
| `CORS_ALLOWED_ORIGINS`, `WS_ALLOWED_ORIGINS` | Origin frontend |

## 5. Kiểm tra nhanh

```bash
curl http://localhost:8080/actuator/health/readiness
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@gmail.com","password":"admin123"}'
```

Upload thử media:

1. Lấy token từ login.
2. Gọi `POST /api/uploads/presign` với `kind=event-cover`.
3. `PUT` file lên `uploadUrl`.
4. Mở `publicUrl` để kiểm tra.

## 6. Test WebSocket nhiều instance

Chạy hai backend cùng DB/Redis, ví dụ port `8080` và `8081`. Kết nối một client STOMP vào `ws://localhost:8081/ws`, sau đó gọi lock ghế qua `8080`; client phải nhận message `LOCKED`.

## 7. Reset dữ liệu local

```bash
docker compose down -v
docker compose up -d postgres redis s3mock
```

Flyway sẽ chạy lại `V1` + `V2` khi backend start.

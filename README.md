# TicketRush

TicketRush là ứng dụng đặt vé sự kiện (Spring Boot + React) được thiết kế để chạy trên AWS theo mô hình 3-tier, multi-AZ.

## Thành phần

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS |
| Backend | Spring Boot 3.5, Java 17, Spring Security + JWT |
| Dữ liệu | PostgreSQL 16, Redis 7 |
| Realtime | STOMP WebSocket + Redis Pub/Sub relay |
| Media | S3 + CloudFront OAC (local: Adobe S3Mock) |
| Hạ tầng | Terraform, AWS EC2 + ASG + ALB + CloudFront + RDS + ElastiCache |
| CI/CD | GitHub Actions + GitHub OIDC |

## Chạy local

Yêu cầu: Docker, Docker Compose, Node 22+. Backend build dùng JDK 17 trong Docker.

```bash
cp .env.example .env
cp frontend/.env-example.txt frontend/.env
# Sửa VITE_MEDIA_BASE_URL nếu cần; mặc định trỏ S3Mock local.

docker compose up -d postgres redis s3mock
docker compose --profile app up --build
```

Mở:

- Frontend: http://localhost:5173
- Backend health: http://localhost:8080/actuator/health/readiness
- S3Mock: http://localhost:9090

Tài khoản admin local (chỉ dùng để test):

```text
admin@gmail.com / admin123
```

Không dùng mật khẩu này cho môi trường public. Mật khẩu được truyền qua `.env`/Secrets Manager, không nằm trong source.

### Chạy backend ngoài Docker

```bash
cd backend
./mvnw spring-boot:run
```

Cần JDK 17. Nếu máy chỉ có JDK mới hơn, dùng Docker ở trên.

### Chạy frontend ngoài Docker

```bash
cd frontend
npm ci
npm run dev
```

Vite proxy `/api` và `/ws` về `http://localhost:8080`.

## Kiểm tra

```bash
cd backend && ./mvnw -B verify
cd frontend && npm ci && npm run lint && npm run build
cd infra/terraform/envs/demo && terraform init -backend=false && terraform validate
```

## Tài liệu

- [Local development](docs/LOCAL_DEV.md)
- [AWS deployment](docs/AWS_DEPLOY.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Runbook / destroy](docs/RUNBOOK.md)
- [Cost estimate](docs/COST.md)
- [Terraform](infra/terraform/README.md)

## Ghi chú kiến trúc

- WebSocket dùng native STOMP (không còn SockJS) và Redis Pub/Sub để đồng bộ giữa nhiều EC2.
- `QueueScheduler` dùng ShedLock Redis để chỉ một instance xử lý mỗi chu kỳ.
- Upload media dùng presigned PUT; bucket private, đọc qua CloudFront OAC.
- Flyway quản lý schema; Hibernate `ddl-auto=validate`.
- Actuator readiness chỉ kiểm tra DB, không kiểm tra Redis, để Redis failover không làm ASG loại bỏ toàn bộ instance.

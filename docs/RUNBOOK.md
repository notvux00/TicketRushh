# Runbook

## Kiểm tra sức khỏe

```bash
curl -i https://ticketrush.sudothanh.me/api/status
curl -i https://ticketrush.sudothanh.me/actuator/health/readiness
```

`/actuator/health/readiness` chỉ phụ thuộc DB. Redis outage không làm ASG loại bỏ toàn bộ instance.

## Log

- CloudWatch Logs group của backend (Docker `awslogs`).
- ALB access logs (nếu bật).
- RDS/ElastiCache logs theo Terraform.

## Sự cố thường gặp

| Triệu chứng | Kiểm tra |
|---|---|
| 502/504 từ CloudFront | ALB target health, security group, app port 8080 |
| WebSocket rớt sau ~10 phút | Heartbeat client/server, ALB idle timeout 3600s |
| Message không tới browser khác | Redis Pub/Sub, channel `ticketrush:ws`, subscriber logs |
| Scheduler chạy trùng | ShedLock Redis key, `app.scheduler.environment` |
| Upload 403 | Presigned URL hết hạn, Content-Type/Content-Length, S3 CORS |
| Flyway lỗi | Schema history, `ddl-auto=validate`, rollback migration |
| Admin không login được | `APP_BOOTSTRAP_ADMIN`, `ADMIN_EMAIL`, `ADMIN_RESET_PASSWORD` |

## Destroy demo

```bash
cd infra/terraform/envs/demo
terraform destroy
```

Sau khi destroy:

1. Xóa 4 bản ghi NS `ticketrush` trên Cloudflare.
2. Kiểm tra EIP/NAT Gateway/CloudFront/ECR đã xóa.
3. Kiểm tra AWS Budget và Billing.

Demo profile đã đặt:

- `skip_final_snapshot = true`
- `deletion_protection = false`
- `force_destroy = true` cho S3/ECR
- Secrets Manager recovery window 0 ngày

Không chạy destroy khi còn dữ liệu cần giữ.

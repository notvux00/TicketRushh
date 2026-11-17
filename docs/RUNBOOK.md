# Runbook

## Health và log

Public: GET https://ticketrush.sudothanh.me/api/status. Đổi hostname theo môi trường.

Readiness: http://localhost:8080/actuator/health/readiness từ instance/SSM hoặc ALB target health. CloudFront không có behavior public cho /actuator; không dùng URL public đó để kết luận backend down. Readiness kiểm tra DB, không kiểm tra Redis để tránh ASG loại toàn bộ instance khi Redis failover.

Backend logs: output log_group_name (mặc định /ticketrush/demo/backend). Worker: /aws/lambda/<maintenance_worker_function_name>. Xác nhận email SNS trước khi dựa vào alarm.

## Sự cố

| Triệu chứng | Kiểm tra / hành động |
| --- | --- |
| GitHub không assume role | Bootstrap trust environment subjects, audience STS, immutable IDs, Environment rules; dùng operator credentials cập nhật bootstrap |
| Full apply chờ ACM | NS delegation và DNS validation; tạo Route 53 zone/delegate trước full apply |
| EC2 không chạy app | Image tag SSM có trong ECR, user-data logs, IAM/secret access, DB migrations, port 8080 |
| 502/504 | ALB target health, SG, app logs và DB connectivity |
| Queue count lệch sau restart | Pass keys và lease ledger; count/grant/release tự reconcile. Không DECR/DEL counter thủ công |
| Queue user chưa có pass | Người dùng vào queue/status; service booking cũng cấp admission atomically khi còn quyền |
| Realtime mất | Redis channel ticketrush:ws, subscriber, heartbeat, ALB idle timeout |
| Upload 403 | URL hết hạn, Content-Type/length, bucket CORS và hostname được CSP cho phép |
| Migration lỗi | Giữ V1–V8 bất biến; xem Flyway history, backup và xử lý migration thiếu; không đổi ddl-auto sang update |
| Scanner từ chối camera | HTTPS/localhost, quyền camera, camera đang bị app khác dùng; nhập QR là fallback |
| Vé sai suất / dùng rồi | Không cho vào; kiểm tra suất đang chọn và audit ticket_checkins |
| Voucher xóa bị 409 | Đã liên kết đơn/lịch sử; tắt voucher thay vì xóa |
| Lambda thất bại | Logs, secret/DB TLS, NAT/endpoint, SG, statement/lock timeout; jobs rollback cùng transaction |

## Rollback backend

Dùng scripts/deploy_backend.py theo [AWS_DEPLOY](AWS_DEPLOY.md). Script giữ tag cũ, chờ refresh, phục hồi khi rollout lỗi và dừng nếu ownership đổi. Recovery còn cần image cũ trong ECR, IAM và kết nối AWS. Nếu recovery báo lỗi, kiểm tra trạng thái ASG/SSM trước khi chạy lại; không cancel refresh không xác định chủ sở hữu.

Không rollback schema bằng cách sửa migration. V7 giữ tương thích cancel của release cũ; V8 thêm audit voucher và cho phép quota null. Trước rollback image vẫn phải đối chiếu compatibility với schema/dữ liệu hiện tại.

## Destroy demo

Xác nhận account, backend state và dữ liệu không cần giữ trước khi chạy:

```bash
terraform -chdir=infra/terraform/envs/demo plan -destroy
terraform -chdir=infra/terraform/envs/demo destroy
```

Demo cho phép xóa DB không final snapshot, S3/ECR có dữ liệu, secret không recovery window; đây là xóa dữ liệu thật. Bootstrap/state được quản lý riêng, không xóa cùng demo.

Sau destroy: bỏ NS delegation thủ công, kiểm tra NAT/EIP/ALB/RDS/Redis/CloudFront/ECR/Lambda và billing. Production có deletion protection và cấu hình khác; không dùng quy trình destroy demo cho prod.

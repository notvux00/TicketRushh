# Lập dự toán chi phí

Repository chưa có số liệu hóa đơn từ một deployment AWS thật. Không dùng các con số ước tính cũ như báo giá hoặc cam kết chi phí.

## Cấu hình cần đưa vào dự toán

| Profile | Tài nguyên chính |
| --- | --- |
| Demo | 2–4 EC2 t3.small, EBS, 1 NAT + data processing, ALB/LCU, RDS PostgreSQL Multi-AZ db.t4g.micro, 2 Redis cache.t4g.micro, S3/CloudFront, Route 53, logs/SNS/Secrets Manager và Lambda 15 phút/lần |
| Prod tham chiếu | 3–10 EC2, 2 NAT, DB/Redis lớn hơn, RDS Proxy, WAF và tùy chọn interface endpoints |

Đọc defaults và tfvars của môi trường trước khi tính; đổi instance/storage/retention/traffic sẽ đổi tổng chi phí. Shield Advanced, Backup, CloudTrail, GuardDuty và Config hiện là các cờ placeholder, không có tài nguyên được tạo bởi các cờ đó.

## Cách tính

Dùng AWS Pricing Calculator theo region thực tế và thời gian chạy. Tách compute-hour, storage-month, NAT/ALB/data transfer, CloudFront requests/egress, log ingestion/retention, secrets/API và Lambda. Đối chiếu thuế, credits/free tier và điều kiện tài khoản khi chốt dự toán; không mặc định được miễn phí.

Đặt Budget/email alerts trước apply, kiểm tra Billing trong lúc demo và destroy ngay khi không cần. Destroy xong vẫn kiểm tra tài nguyên còn sót; bootstrap state bucket/logs/backups có thể còn tồn tại riêng.

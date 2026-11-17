# Sơ đồ kiến trúc TicketRush

Sơ đồ do drawio-ai-kit tạo để minh họa demo và hướng phát triển production. Terraform và [kiến trúc hiện tại](../docs/ARCHITECTURE.md) là nguồn đối chiếu cấu hình thực tế.

## Phạm vi

- Demo: 1 NAT, ALB public có origin protection, EC2 private/ASG 2–4, RDS Multi-AZ và Redis 2 nodes.
- Production tham chiếu: ALB private/VPC Origin, WAF, RDS Proxy, ASG 3–10.
- Các hình production còn minh họa Shield Advanced, Backup, CloudTrail, GuardDuty, Config và DR. Các mục đó không tương đương tài nguyên đã triển khai; các cờ tương ứng trong Terraform hiện là placeholder.
- Worker Lambda chỉ được nối trong profile Terraform demo. Xem tài liệu vận hành thay vì suy ra trạng thái deploy từ hình.

## Build và validation

```bash
cd diagrams
npm ci
npm run build
npm run validate
```

Script hiện ghi tới ../../docs/architecture tính từ thư mục diagrams; trong layout repo này đó là thư mục docs cạnh TicketRushh, không phải TicketRushh/docs. Kiểm tra đường dẫn đích trước khi regenerate. Không tự di chuyển hoặc ghi đè tài liệu bên ngoài workspace.

Hai nguồn là build_demo.mjs và build_production.mjs; mỗi nguồn sinh file TicketRush-AWS-Architecture-<Profile>.drawio. Các npm scripts render có sẵn nhưng không cần cho kiểm tra mã nguồn/tài liệu; không chạy render hoặc kiểm tra ảnh trong quy trình hiện tại.

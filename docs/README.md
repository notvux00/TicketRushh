# Tài liệu TicketRush

Tài liệu mô tả mã nguồn hiện có. Hệ thống đã được kiểm thử local; chưa deploy/apply AWS trong phiên làm việc này.

| Tài liệu | Nội dung |
| --- | --- |
| [ARCHITECTURE](ARCHITECTURE.md) | Thành phần, luồng booking/queue, admin API, schema và giới hạn |
| [LOCAL_DEV](LOCAL_DEV.md) | Khởi động local, biến môi trường và lệnh kiểm thử |
| [AWS_DEPLOY](AWS_DEPLOY.md) | Bootstrap, DNS, worker package, image và triển khai demo |
| [AWS_INFRASTRUCTURE](AWS_INFRASTRUCTURE.md) | Đặc tả kiến trúc và cấu hình hạ tầng AWS cho demo |
| [RUNBOOK](RUNBOOK.md) | Health, log, xử lý sự cố, rollback và destroy |
| [DEMO_SCRIPT](DEMO_SCRIPT.md) | Kịch bản theo chức năng đã có |
| [COST](COST.md) | Các nguồn chi phí và cách lập dự toán |
| [Terraform](../infra/terraform/README.md) | Module, profile, state và validation |
| [Bootstrap](../infra/terraform/bootstrap/README.md) | State backend và GitHub OIDC trust |
| [Worker](../infra/lambda/maintenance/README.md) | SQL jobs, đóng gói, test và vận hành Lambda |
| [Diagrams](../diagrams/README.md) | Sơ đồ minh họa và khác biệt so với Terraform |

Admin có các route `/admin`, `/admin/events`, `/admin/add-event`, `/admin/vouchers`, `/admin/checkin`. Backend check-in hỗ trợ ADMIN/STAFF; giao diện admin hiện chỉ dành cho ADMIN.

Spec đã hoàn tất và các báo cáo review không còn được giữ trong thư mục này. Các hành vi cần bảo vệ được lưu bằng regression tests.

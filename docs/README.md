# Tài liệu TicketRush

Tài liệu mô tả mã nguồn hiện có. Bản demo đang chạy trên AWS tại **https://ticketrush.sudothanh.me**; hạ tầng được quản lý bằng Terraform.

| Tài liệu | Nội dung |
| --- | --- |
| [ARCHITECTURE](ARCHITECTURE.md) | Thành phần, luồng booking/queue, admin API, schema và giới hạn |
| [LOCAL_DEV](LOCAL_DEV.md) | Khởi động local, biến môi trường và lệnh kiểm thử |
| [AWS_DEPLOY](AWS_DEPLOY.md) | Bootstrap, DNS, worker package, image và triển khai demo |
| [AWS_INFRASTRUCTURE](AWS_INFRASTRUCTURE.md) | Đặc tả kiến trúc và cấu hình hạ tầng AWS cho demo |
| [RUNBOOK](RUNBOOK.md) | Health, log, xử lý sự cố, rollback và destroy |
| [DEMO_SCRIPT](DEMO_SCRIPT.md) | Kịch bản theo chức năng đã có |
| [Slide thuyết trình TicketRush](slides/ticketrush-bao-ve-aws.html) | Kiến trúc AWS, luồng đặt vé và kết quả triển khai |
| [COST](COST.md) | Các nguồn chi phí và cách lập dự toán |
| [Terraform](../infra/terraform/README.md) | Module, profile, state và validation |
| [Bootstrap](../infra/terraform/bootstrap/README.md) | State backend và GitHub OIDC trust |
| [Worker](../infra/lambda/maintenance/README.md) | SQL jobs, đóng gói, test và vận hành Lambda |
| [Diagrams](../diagrams/README.md) | Sơ đồ minh họa và khác biệt so với Terraform |
| [Image credits](IMAGE_CREDITS.md) | Nguồn và giấy phép ảnh demo |
| [AGENT](../AGENT.md) | Quy trình thực thi task nội bộ |
| [Task backlog](../task.md) | Trạng thái các hạng mục cải thiện |

### Xem và sửa slide

Sau khi clone repo, mở file HTML trong trình duyệt. Dùng phím mũi tên để chuyển
slide, **F** để bật toàn màn hình và **H** để hiện thanh điều khiển. Trên điện thoại,
vuốt ngang để chuyển slide.

Để sửa chữ, bấm **E** trong trình duyệt, chỉnh nội dung rồi bấm **Ctrl+S** để tải bản HTML.
Thay file trong docs/slides/ bằng bản đã sửa. Để chỉnh bố cục hoặc ảnh, mở HTML
bằng trình soạn thảo và commit file đã cập nhật.

Admin có các route `/admin`, `/admin/events`, `/admin/add-event`, `/admin/vouchers`, `/admin/checkin`. Backend check-in hỗ trợ ADMIN/STAFF; giao diện admin hiện chỉ dành cho ADMIN.

Spec đã hoàn tất và các báo cáo review không còn được giữ trong thư mục này. Các hành vi cần bảo vệ được lưu bằng regression tests.

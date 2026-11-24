# Kế hoạch tái dựng Terraform và Lambda Role 3

Ngày lập 24/11/2026. Bản tham chiếu Git `f39d0b9cd2f737ae06b3994b1702cb3424deee37`.

Kế hoạch được lập từ cấu hình và thiết kế đã có để tái dựng phần dữ liệu, bảo trì và giám sát trong một nhánh cục bộ. Mục tiêu là khớp từng byte của các file Git được tái dựng. Dùng `role3-contract.json` làm đặc tả chính xác và dành `role3-original.zip` cho bước đối chiếu cuối. Hai file này cùng manifest SHA-256 nằm trong bộ lưu trữ bàn giao ngoài repository.

## Phạm vi

- `infra/terraform/modules/{data,maintenance_worker,observability}/{main,outputs}.tf` và `infra/lambda/maintenance/maintenance.py`.
- Giữ nguyên tên, mô tả output, biến, provider, phiên bản, Terraform root demo/prod, mạng và security group dùng chung, cơ chế đóng gói Lambda, dependency và các bài kiểm thử hiện có. Không đổi schema, backend ứng dụng hoặc quy trình CI/CD.
- Scaffold thay tài nguyên bằng comment và đổi output phụ thuộc tài nguyên thành `null`. Giữ các output độc lập `db_port`, `db_name` và `redis_port`. Worker giữ tên hàm `handler` và `run_jobs` với lỗi tường minh khi gọi.
- Scaffold là mốc trung gian cục bộ. Để nguyên state và tài nguyên AWS, kể cả lúc kiểm tra scaffold.

## 1. Dữ liệu và Secrets Manager

1. Khôi phục data source tài khoản AWS và region, tags chung và các resource mật khẩu. DB và Redis dùng 40 ký tự, JWT và khóa ký vé dùng 64 ký tự, tất cả đều tắt ký tự đặc biệt. Chỉ sinh mật khẩu admin 24 ký tự khi biến mật khẩu để trống.
2. Tạo năm secret và version theo đúng địa chỉ Terraform: `db`, `redis`, `jwt`, `ticket_signing`, `admin`. Giữ tên đường dẫn `ticket-signing`, thời gian phục hồi theo input, JSON DB gồm username/password/dbname, JSON Redis gồm auth_token. Giữ nguyên kiểu payload chuỗi của ba secret còn lại.
3. Khôi phục subnet group và RDS PostgreSQL 16, cổng 5432, gp3 mã hóa, subnet private, Security Group lấy từ input, Multi-AZ và retention lấy từ biến. Backup 03:00–04:00 UTC, bảo trì Chủ nhật 04:00–05:00 UTC. Giữ các cờ autosize, snapshot cuối và deletion protection theo profile. Multi-AZ phục vụ dự phòng; đường truy cập CSDL nằm trong mạng riêng.
4. Khôi phục cấu hình RDS Proxy có điều kiện trong module dùng chung. Giữ IAM đọc đúng secret DB, điều kiện KMS qua Secrets Manager của region, auth SECRETS, bắt buộc TLS, idle timeout 1800 giây và pool 80/50/120. Địa chỉ DB output chọn endpoint proxy khi bật.
5. Khôi phục subnet group Redis, parameter group redis7 với noeviction và sự kiện Ex, replication group có số node và Multi-AZ theo input. Giữ TLS, mã hóa lưu trữ, auth token ROTATE, snapshot giữ 5 ngày và các khung giờ gốc. TTL của khóa ghế do tầng ứng dụng quản lý. Khôi phục toàn bộ outputs theo thứ tự đặc tả.

## 2. Bảo trì bằng Lambda và EventBridge

1. Khôi phục `maintenance.py` với bốn câu SQL theo đúng thứ tự. Chuyển đơn PENDING quá hạn sang EXPIRED, xóa vé thuộc đơn EXPIRED, giải phóng ghế LOCKED quá 15 phút và vô hiệu hóa voucher hết hạn hoặc hết lượt. Giữ nguyên điều kiện và cột theo đặc tả; giữ một transaction, thống kê rowcount cho từng thao tác, đóng kết nối kể cả khi có lỗi.
2. Khôi phục Secrets Manager client dùng lại giữa các lần gọi. Giữ timeout kết nối/đọc 3 giây, một lần thử, PostgreSQL bắt buộc TLS, timeout kết nối 5 giây, múi giờ UTC, statement timeout 5000 ms và lock timeout 2000 ms. Giữ tên biến môi trường, cấu trúc log, payload trả về và việc truyền lỗi lên Lambda.
3. Khôi phục archive zip theo hai nhánh psycopg2 layer hoặc package dựng sẵn, IAM role cho Lambda, policy VPC access, quyền đọc secret DB và KMS qua Secrets Manager. Khai báo log group với thời gian giữ log từ input.
4. Khôi phục Lambda `maintenance.handler`, Python 3.12 x86_64, 128 MB, 30 giây, concurrency theo input, tham chiếu subnet ứng dụng private và Lambda SG. Giữ source hash và phụ thuộc IAM/log group. Tạo EventBridge rule mỗi 15 phút, target và permission chỉ cho rule đó; khôi phục ba output của module. Lịch tách công việc dọn dữ liệu khỏi request đặt vé.

## 3. Giám sát bằng CloudWatch và SNS

1. Khôi phục topic SNS và email subscription có điều kiện khi email có giá trị. Sáu alarm cùng gửi SNS khi sang ALARM và OK, xử lý thiếu dữ liệu bằng `notBreaching`.
2. Giữ đúng metric, dimension, statistic, toán tử, chu kỳ và ngưỡng theo đặc tả. ALB 5xx dùng Sum với 1 kỳ 300 giây; độ trễ target dùng Average 2 kỳ 300 giây; unhealthy targets dùng Maximum 2 kỳ 60 giây, ngưỡng 1. CPU ASG, RDS và Redis dùng Average 3 kỳ 300 giây, ngưỡng theo biến. Giữ dimension LoadBalancer, TargetGroup, AutoScalingGroupName, DBInstanceIdentifier và ReplicationGroupId tương ứng.
3. Khôi phục dashboard có điều kiện, ba widget về ALB, CPU và target health. Giữ tọa độ, thứ tự widget, chu kỳ và biểu thức JSON từ đặc tả. Khôi phục outputs SNS ARN, tên dashboard và danh sách alarm.

## Thứ tự commit lại

| Giai đoạn | Commit | Phạm vi |
| --- | --- | --- |
| Dữ liệu | 1. `feat(terraform): configure application secrets` | Mật khẩu và Secrets Manager cho PostgreSQL, Redis, JWT, vé QR và admin. |
| Dữ liệu | 2. `feat(terraform): configure PostgreSQL and RDS Proxy` | Subnet group, RDS PostgreSQL Multi-AZ, backup và RDS Proxy theo profile. |
| Dữ liệu | 3. `feat(terraform): configure ElastiCache Redis` | Subnet group, parameter group, Redis replication group, failover và snapshot. |
| Bảo trì | 4. `feat(lambda): restore scheduled maintenance jobs` | Mã Python của maintenance worker và bốn tác vụ SQL. |
| Bảo trì | 5. `feat(terraform): wire Lambda to EventBridge` | Đóng gói Lambda, IAM, log group và lịch EventBridge mỗi 15 phút. |
| Giám sát | 6. `feat(terraform): configure CloudWatch alarms and SNS` | SNS topic, đăng ký email và sáu alarm CloudWatch. |
| Giám sát | 7. `feat(terraform): configure CloudWatch dashboard` | Dashboard cho ALB, EC2, RDS và Redis. |

Mỗi commit khôi phục các output có đủ tài nguyên phụ thuộc ở bước đó. Bước đối chiếu cuối thực hiện sau commit thứ 7.

Mỗi bước chỉ ghi file thuộc nhóm đó. Trong contract, mảng `sections` chứa các đoạn UTF-8 theo thứ tự tài nguyên Terraform hoặc vùng chức năng Python. Ghép thuộc tính `text` theo thứ tự, không chèn thêm dấu xuống dòng, không đổi comment, spacing, địa chỉ, thứ tự hoặc kiểu kết thúc dòng. Sau khi stage, băm nội dung Git đã chuẩn hóa và so với SHA-256 trong contract. Kiểm tra đủ bảy file và toàn bộ thư mục được lưu trong ZIP so với mốc tham chiếu.

## Kiểm tra sau tái dựng

- Kiểm tra Terraform fmt, init không backend và validate cho demo/prod trên bản sao. Chạy test worker Terraform ở chế độ mock và kiểm thử Python hiện có. Nếu thiếu tool hoặc dependency, ghi rõ kiểm tra nào chưa chạy.
- Dùng `git diff --exit-code f39d0b9 -- infra/terraform infra/lambda` trên bản đã tái dựng. Tách riêng việc so hash với ZIP ngoài repo.
- Nếu có đợt triển khai được duyệt sau đó, kiểm tra RDS Multi-AZ và backup, Redis replica, log Lambda từ lần chạy theo lịch và số dòng xử lý trên dữ liệu thử, cùng lịch sử CloudWatch Alarm và email SNS. Báo riêng kết quả AWS của lần triển khai đó.

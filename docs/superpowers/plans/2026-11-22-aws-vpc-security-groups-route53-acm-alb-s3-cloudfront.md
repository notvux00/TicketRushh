# Plan triển khai VPC, Security Groups, Route 53, ACM, ALB, S3 và CloudFront

**Ngày lập:** 22/11/2026. **Mốc tham chiếu:** `1ea626d785e1c09ba01c92fa2ef480592d060f99`.

Tài liệu được lập từ cấu hình Terraform đã có để hướng dẫn triển khai các module network, security và edge trong lần tái dựng cục bộ. Cấu hình đích là môi trường **demo** ở Singapore (`ap-southeast-1`). Các module dùng chung vẫn phải tương thích với cấu hình prod trong repo.

Đọc [AWS Infrastructure](../../AWS_INFRASTRUCTURE.md) để nắm kiến trúc và dùng đặc tả từng block Terraform lưu cục bộ trong `2026-11-22-terraform-role1-contract.json` để lấy đầy đủ giá trị. Đặc tả được trích từ mốc tham chiếu và ghi cả địa chỉ resource, thứ tự, biểu thức HCL, comment và khoảng trắng để tái tạo chính xác. Khi thực hiện, dùng đặc tả làm đầu vào và để bản Terraform tham chiếu riêng cho bước đối chiếu cuối.

## Phạm vi và giao diện

| Module | File triển khai | Giao diện với các vai trò khác |
| --- | --- | --- |
| `network` | `main.tf`, `outputs.tf` | VPC, CIDR, AZ, subnet, route table, NAT và endpoint |
| `security` | `main.tf`, `outputs.tf` | SG cho ALB, app, RDS, RDS Proxy, Redis, Lambda |
| `edge` | `alb.tf`, `dns.tf`, `s3_cloudfront.tf`, `outputs.tf` | DNS và chứng chỉ, ALB/target group, CloudFront, bucket frontend/media và tên tham số SSM |

Các đường dẫn trên nằm dưới `infra/terraform/modules/`. Giữ nguyên inputs trong `variables.tf`, provider, cấu hình root `envs/demo` và `envs/prod`, IAM instance role/profile ở module security, WAF ở module edge, mã SPA fallback, cùng các module compute, data, maintenance_worker, observability và bootstrap. Các tham chiếu giữa module đi qua output hiện có, giữ nguyên tên và biểu thức.

## Bước 1. Chuẩn bị bản base cục bộ

- Giữ nguyên khai báo biến và cấu hình nối module ở root. Thay phần triển khai mạng và edge bằng comment ngắn. Trong `edge/alb.tf`, giữ nguyên block `locals` để WAF dùng được tên và tags chung.
- Trong `security/main.tf`, giữ hai data source AWS account/region, `locals` dùng chung và toàn bộ phần IAM EC2. Để lại comment ở chỗ triển khai security group và các rule.
- Giữ tên và mô tả output. Dùng `value = null` tạm thời cho các output mạng, Security Groups và edge, giữ nguyên giá trị thật của `instance_profile_name`, `instance_role_arn` và `waf_web_acl_arn`.
- Lưu snapshot base ngoài repo để xem lại. Bản base tạm thời thiếu resource và không dùng để deploy. Bản base được lưu trong commit `0739454`.

## Bước 2. Triển khai VPC và định tuyến

- Tạo VPC `10.0.0.0/16`, lấy hai AZ khả dụng đầu tiên không yêu cầu opt-in, bật hỗ trợ DNS và DNS hostname. VPC nhận IPv6 do AWS cấp. Hai public subnet dùng `cidrsubnet` để chia IPv6 theo index. Giữ tắt cấp IP công khai tự động và cấp IPv6 tự động khi tạo tài nguyên trong public subnet.
- Trong AZ A và B lần lượt tạo public subnet `10.0.0.0/24`, `10.0.1.0/24`, app subnet `10.0.10.0/24`, `10.0.11.0/24`, data subnet `10.0.20.0/24`, `10.0.21.0/24`. Số lượng subnet lấy từ danh sách CIDR của từng tầng.
- Tạo IGW. Hai public subnet dùng cùng bảng định tuyến với `0.0.0.0/0` và `::/0` trỏ IGW. Demo có một NAT Gateway kèm Elastic IP ở public subnet đầu tiên. Mỗi app subnet có bảng riêng và route IPv4 mặc định tới NAT ở index modulo số NAT, nên cả hai AZ cùng đi qua NAT đầu tiên ở demo. Khi số NAT bằng 0 thì không tạo route này. Mỗi data subnet có bảng riêng, không khai báo default route ra Internet.
- Tạo S3 Gateway Endpoint gắn vào các app route table. Interface Endpoint là tuỳ chọn tắt trong demo. Khi bật, tạo endpoint cho ecr.api, ecr.dkr, logs, secretsmanager, ssm, ssmmessages và ec2messages theo danh sách mặc định. Gắn endpoint vào app subnet, bật private DNS và dùng SG nhận TCP 443 từ VPC CIDR, cho phép egress mọi giao thức tới VPC CIDR. Giữ nguyên tags, dependency và output chi tiết theo đặc tả.

## Bước 3. Triển khai security group

Tạo SG cho ALB, app, RDS, RDS Proxy, Redis và Lambda. Với kết nối giữa hai nhóm, dùng tham chiếu ID SG trong rule phù hợp và giữ đúng chiều trong đặc tả.

| Luồng | Rule |
| --- | --- |
| CloudFront → ALB demo | TCP 443 từ AWS managed prefix list `com.amazonaws.global.cloudfront.origin-facing` |
| CloudFront VPC origin → ALB | TCP 443 từ VPC CIDR khi bật VPC origin, thay cho rule prefix list |
| ALB → app | TCP 8080, egress từ ALB và ingress vào app |
| App → RDS hoặc RDS Proxy, Proxy → RDS | TCP 5432, rule riêng cho từng cặp nguồn/đích |
| App → Redis | TCP 6379, egress từ app và ingress vào Redis |
| Lambda → RDS | TCP 5432, egress từ Lambda và ingress vào RDS |
| App và Lambda → HTTPS/DNS | TCP 443 tới `0.0.0.0/0`, TCP/UDP 53 tới VPC CIDR |
| App → Amazon Time Sync | UDP 123 tới `169.254.169.123/32` |

Môi trường demo tắt RDS Proxy ở module data. Các rule và output liên quan SG của proxy vẫn giữ theo hợp đồng module dùng chung. Các rule riêng tách khỏi khai báo SG theo dạng `aws_vpc_security_group_ingress_rule` và `aws_vpc_security_group_egress_rule`. Giữ nguyên IAM EC2 từ base.

## Bước 4. Triển khai edge

1. **ALB.** IPv4, public trong demo, trải hai public subnet. ALB chỉ có listener HTTPS 443 với policy `ELBSecurityPolicy-TLS13-1-2-2021-06`. Giữ idle timeout 3.600 giây, loại header HTTP không hợp lệ, chế độ desync `defensive`. Target group loại instance, HTTP 8080, round robin, deregistration delay 30 giây. Health check `/actuator/health/readiness`, mong đợi 200, lặp mỗi 15 giây, timeout 5 giây, ngưỡng healthy và unhealthy đều 3.
2. **Bảo vệ origin.** Terraform tạo chuỗi ngẫu nhiên 40 ký tự, không có ký tự đặc biệt, lưu dưới dạng SSM `SecureString` tại `/ticketrush/demo/origin-verify`. CloudFront gắn giá trị vào `X-Origin-Verify`. ALB listener rule ưu tiên 100 forward tới target group khi khớp header. Default action trả 403. Giữ nhánh CloudFront VPC Origin khi biến bật và để nhánh này tắt trong demo.
3. **Route 53 và ACM.** Hosted zone `ticketrush.sudothanh.me`. Tạo ACM ở `us-east-1` cho CloudFront và ở region chính cho ALB với tên `origin.ticketrush.sudothanh.me`. Dùng DNS validation, TTL bản ghi validation 60 giây, timeout 30 phút. Bản ghi alias A và AAAA của tên app trỏ CloudFront. Alias A của tên origin trỏ ALB và bật evaluate target health, hai alias CloudFront tắt tuỳ chọn này. Giữ provider alias và lifecycle theo đặc tả.
4. **S3 và truy cập origin.** Tạo hai bucket theo prefix root truyền, frontend và media riêng. Bật bốn cờ chặn public access, `BucketOwnerEnforced` và AES256. Dùng OAC SigV4 riêng cho mỗi bucket. Bucket policy giới hạn quyền đọc của CloudFront bằng distribution ARN. Media CORS cho hai origin mặc định là https://ticketrush.sudothanh.me và http://localhost:5173 do root truyền vào. Cho phép GET, PUT, HEAD, POST và mọi request header, expose ETag, max age 3.000 giây. Giữ chính xác policy và điều kiện `force_destroy` trong đặc tả.
5. **CloudFront.** Alias là tên app, IPv6 bật, `http2and3`, cổng người dùng chuyển hướng sang HTTPS, viewer TLS tối thiểu `TLSv1.2_2021`, `PriceClass_200` trong demo. Origin ALB dùng HTTPS và TLS 1.2, đọc tối đa 120 giây và giữ kết nối 5 giây. Gắn response headers policy theo đặc tả, gồm CSP và HSTS. Giữ nhánh WAF trong module, demo tắt WAF.

| Đường dẫn | Origin | Chính sách |
| --- | --- | --- |
| Mặc định | S3 frontend | `Managed-CachingOptimized`, nén, chạy CloudFront Function SPA tại `viewer-request` |
| `/api/*` | ALB | `Managed-CachingDisabled`, `Managed-AllViewerExceptHostHeader`, nén |
| `/ws*` | ALB | `Managed-CachingDisabled`, `Managed-AllViewerExceptHostHeader`, tắt nén |
| `/media/*` | S3 media | `Managed-CachingOptimized`, nén |

Giữ thứ tự behavior trong bảng. Gắn SPA fallback vào behavior mặc định để API tiếp tục trả mã lỗi gốc; root object là `index.html`.

## Thứ tự commit

```text
feat(terraform): define VPC and subnets
feat(terraform): configure routing and NAT
feat(terraform): configure VPC endpoints
feat(terraform): define ALB and app security groups
feat(terraform): define data and worker security groups
feat(terraform): configure Route 53 zone and ACM
feat(terraform): configure ALB and origin verification
feat(terraform): create private frontend and media buckets
feat(terraform): configure CloudFront and DNS aliases
```

## Bước 5. Dùng đặc tả và kiểm tra

- Đặc tả có `files` theo đường dẫn tương đối trong repo. Mỗi file có `blocks` theo thứ tự và `tail` ở cuối. Mỗi block có `before` là các dòng trước block, `kind`, `labels`, `body` là các dòng giữa hai dấu ngoặc của block và `inline` đánh dấu block rỗng viết trên một dòng.
- Dựng header từ `kind` và từng nhãn trong dấu ngoặc kép, ghép với phần thân theo thứ tự. Giữ nguyên dòng trong `before`, `body` và `tail`, dùng LF khi so sánh. Chỉ ghi tám file trong đặc tả, theo thứ tự network → security → edge.
- Chạy `terraform fmt -check -recursive infra/terraform`. Với Terraform 1.16.6 như CI, chạy `terraform init -backend=false -lockfile=readonly -input=false` và `terraform validate` từ từng root demo/prod trong bản sao dùng để kiểm tra.
- Kiểm tra `git diff --exit-code 1ea626d -- infra/terraform` và đối chiếu toàn bộ cây Terraform đã theo dõi với snapshot độc lập. Điều kiện đạt là không có file thiếu, file thừa hoặc nội dung khác sau khi chuẩn hoá xuống dòng của Git. Không dùng `terraform apply` trong quy trình tái dựng.

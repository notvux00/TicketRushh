# TicketRush Terraform

Mã hạ tầng cho backend Spring Boot, frontend React và maintenance worker. Chưa xác nhận apply AWS thật. Dùng [hướng dẫn triển khai demo](../../docs/AWS_DEPLOY.md) làm trình tự triển khai chính; các lệnh bên dưới là tham chiếu module và validation.

## Module và profile

| Module | Vai trò |
| --- | --- |
| network | VPC, public/app/data subnets trên 2 AZ, NAT và endpoints |
| security | SG, EC2 instance role/profile, DB/Redis/Lambda access |
| data | PostgreSQL, Redis và secrets; RDS Proxy tùy profile |
| edge | DNS/ACM, ALB, CloudFront/S3 OAC, SPA routing, CSP, WAF tùy profile |
| compute | ECR, image-tag SSM, launch template/user data, ASG |
| observability | CloudWatch/SNS, alarms/dashboard |
| maintenance_worker | Lambda Python 3.12/x86_64, EventBridge mỗi 15 phút |

Demo: 1 NAT, ALB public nhưng SG giới hạn CloudFront và listener yêu cầu X-Origin-Verify, ASG 2–4 t3.small, RDS Multi-AZ db.t4g.micro, Redis 2 nodes; nối worker vào private app subnets.

Prod: 2 NAT, ALB private qua VPC Origin, WAF, RDS Proxy, ASG 3–10, tùy chọn interface endpoints. Chỉ là profile tham chiếu; chưa nối maintenance_worker. Shield Advanced, Backup, CloudTrail, GuardDuty, Config là cờ placeholder, không tạo tài nguyên.

CloudFront route frontend mặc định, /api/* và /ws* về ALB không cache, /media/* về S3. /actuator không được route public. ALB dùng readiness nội bộ. S3 private/OAC; browser upload trực tiếp tới media bucket qua presigned PUT.

## Toolchain và state

Dùng Terraform 1.16.6 để khớp CI; required_version trong module >=1.6. AWS provider ~>6.17, random ~>3.6, archive ~>2.0 nơi cần.

[Bootstrap](bootstrap/README.md) tạo state bucket/DynamoDB lock và role OIDC. Demo/prod dùng S3 backend riêng, key ticketrush/demo/terraform.tfstate và ticketrush/prod/terraform.tfstate. Khởi tạo với các backend-config lấy từ bootstrap; không dùng backend rỗng cho stack đã tồn tại. Bootstrap có state riêng và cần operator credentials khi sửa trust policy.

Thứ tự lần đầu: bootstrap → init state → hosted zone/delegation → build worker → tạo ECR/push image khớp image_tag → full plan/apply → frontend. Xem [AWS_DEPLOY](../../docs/AWS_DEPLOY.md) cho lệnh và điều kiện GitHub Environment.

## Backend và compatibility

Backend khởi động lấy image tag từ SSM, secrets qua instance role và chạy container port 8080, awslogs. Dùng scripts/deploy_backend.py để chờ refresh và phục hồi tag cũ nếu rollout lỗi; image cũ phải còn trong ECR. Không publish nhiều deployment cùng môi trường ngoài cơ chế concurrency.

Flyway V1–V8 là nguồn schema; không sửa migration đã áp dụng. Giữ group=true để các migration đang thiếu xuất hiện cùng transaction. V7 trì hoãn kiểm tra xóa checkout sống đến commit để tương thích cách cancel cũ; issued tickets vẫn được bảo vệ ngay. V8 bổ sung audit voucher và quota không giới hạn qua total_quantity=null.

Redis parameter group bật Ex, noeviction và TLS. Backend không chạy CONFIG. Queue lease/counter được đối soát bằng Lua; notification chỉ hỗ trợ cập nhật sớm, không phải nguồn duy nhất của active count.

## Frontend publish thủ công

Dùng workflow serialized là mặc định. Nếu publish thủ công, không chạy đồng thời workflow; build từ repo root với biến production:

```bash
(cd frontend && npm ci && VITE_API_URL=/api VITE_WS_URL="" VITE_MEDIA_BASE_URL="" npm run build)
BUCKET=$(terraform -chdir=infra/terraform/envs/demo output -raw frontend_bucket_name)
aws s3 sync frontend/dist "s3://$BUCKET" \
  --cache-control "public,max-age=31536000,immutable" --exclude "index.html"
aws s3 cp frontend/dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate"
aws cloudfront create-invalidation \
  --distribution-id "$(terraform -chdir=infra/terraform/envs/demo output -raw cloudfront_distribution_id)" \
  --paths "/" "/index.html"
```

Giữ hashed assets cũ để index đang cache còn tải được; không thêm --delete vào publish. Cleanup asset là thao tác retention riêng sau cửa sổ cache/rollback.

## Validation không apply

Từ repo root:

```bash
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform/envs/demo init -backend=false
terraform -chdir=infra/terraform/envs/demo validate
terraform -chdir=infra/terraform/envs/prod init -backend=false
terraform -chdir=infra/terraform/envs/prod validate
terraform -chdir=infra/terraform/bootstrap init -backend=false
terraform -chdir=infra/terraform/bootstrap test
terraform -chdir=infra/terraform/modules/compute init -backend=false
terraform -chdir=infra/terraform/modules/compute test
```

Worker package/mock tests: [worker README](../lambda/maintenance/README.md). Init cần tải provider nhưng không apply tài nguyên. Validate/mock plan không thay cho STS, ECR, DNS, quota hoặc smoke test trên AWS thật.

## Vận hành

Theo [RUNBOOK](../../docs/RUNBOOK.md) cho logs, readiness, rollback và destroy. Xác nhận email SNS. Demo cho phép xóa DB không final snapshot, secrets không recovery và S3/ECR chứa dữ liệu; bootstrap được quản lý riêng. Prod có deletion protection/retention khác, không áp dụng quy trình destroy demo cho prod.

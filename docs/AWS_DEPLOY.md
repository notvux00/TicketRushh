# Triển khai AWS demo

Bản demo đã được triển khai tại https://ticketrush.sudothanh.me (2026-11-19). Tài liệu này vẫn là hướng dẫn vận hành/tái triển khai; prod là profile tham chiếu, không triển khai mặc định.

Các lệnh dưới đây dùng Bash và chạy từ repo root nếu không chỉ định khác.

## Chuẩn bị

AWS CLI có credentials/quyền phù hợp; Terraform 1.16.6 (khớp CI), Docker, Python, Node >=22.12. Xác nhận account/region bằng aws sts get-caller-identity; mặc định region ap-southeast-1. Cần quyền quản lý DNS cho domain, email alarm và quota cho tài nguyên demo.

Thay domain/subdomain trong terraform.tfvars nếu không dùng ticketrush.sudothanh.me. Đặt admin_password="" để Terraform sinh mật khẩu; không dùng admin123 của file mẫu trên môi trường public. Lập ngân sách theo [COST](COST.md).

## Bootstrap và state

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# Điền state_bucket_name, github_org, github_repo và environment được phép.
terraform init
terraform plan
terraform apply
terraform output
```

Bootstrap quản lý state bucket, DynamoDB lock và GitHub OIDC role riêng. Với role có sẵn, cần apply lại bootstrap bằng operator credentials để cập nhật trust, trước khi job environment có thể assume role. Xem [bootstrap README](../infra/terraform/bootstrap/README.md), gồm immutable subject IDs và GitHub Environment branch/reviewer rules.

```bash
cd ../envs/demo
cp terraform.tfvars.example terraform.tfvars
# Sửa admin_email, admin_password, alarm_email, domain/subdomain.
terraform init -backend-config="bucket=YOUR-STATE-BUCKET" \
  -backend-config="key=ticketrush/demo/terraform.tfstate" \
  -backend-config="region=ap-southeast-1" \
  -backend-config="dynamodb_table=YOUR-LOCK-TABLE"
```

Dùng đúng state đang quản lý môi trường; migrate/import có kiểm soát nếu đã có tài nguyên. Không tạo state rỗng cho stack đã tồn tại. init -backend=false chỉ dùng validation local, không thay cho backend deploy.

## Khởi tạo DNS trước ACM

Trong infra/terraform/envs/demo:

```bash
terraform apply -target=module.edge.aws_route53_zone.this
terraform output route53_name_servers
```

Nếu output chưa xuất hiện sau targeted apply, xem terraform state show module.edge.aws_route53_zone.this. Tạo một NS record trên DNS nhà cung cấp cho mỗi nameserver, tên subdomain ticketrush. Giữ nguyên apex domain; không đặt A/AAAA/CNAME trùng tên delegation. Với Cloudflare, không bật proxy; NS không có chế độ proxy.

Kiểm tra dig +short NS ticketrush.sudothanh.me khớp Route 53 trước full apply. ACM và record origin.ticketrush.sudothanh.me được Terraform quản lý; full apply trước delegation có thể chờ validation thất bại.

## Đóng gói worker và chuẩn bị image đầu tiên

Từ repo root:

```bash
python infra/lambda/maintenance/build.py
terraform -chdir=infra/terraform/envs/demo apply -target=module.compute.aws_ecr_repository.backend
ECR_URL=$(terraform -chdir=infra/terraform/envs/demo output -raw ecr_repository_url)
TAG=latest # Khớp image_tag trong tfvars cho lần khởi tạo; nếu đổi tfvars thì đổi TAG.
aws ecr get-login-password --region ap-southeast-1 \
  | docker login --username AWS --password-stdin "${ECR_URL%%/*}"
docker build -t "$ECR_URL:$TAG" backend
docker push "$ECR_URL:$TAG"
```

Nếu ECR output chưa hiện sau targeted apply, lấy repository_url bằng terraform state show module.compute.aws_ecr_repository.backend. Các targeted apply trên chỉ phục vụ bootstrap phụ thuộc; sau đó luôn chạy full plan/apply.

Chuẩn bị image trước full apply để ASG không khởi động với ECR rỗng. Nếu đã full apply trước đó, image pull ở EC2 có retry hữu hạn; sau khi push cần refresh ASG, không chỉ chờ app tự lên.

Worker package chứa psycopg2 Linux Python 3.12/x86_64; build lại khi handler/requirements đổi. Demo có worker; profile prod hiện chưa nối module worker.

## Apply demo

```bash
terraform -chdir=infra/terraform/envs/demo plan -out=tfplan
terraform -chdir=infra/terraform/envs/demo apply tfplan
```

Các tài nguyên gồm VPC, ASG/ALB, DB/Redis, CloudFront/S3, DNS/ACM, alarms và worker. Cần hoàn tất dữ liệu DNS và image ở trên trước bước này. Kiểm tra Terraform outputs và ALB target health sau apply.

## GitHub Actions

Tạo GitHub Environments demo/prod với branch protection và required reviewers phù hợp. Cấu hình variables tại environment được chọn:

| Nhóm | Variables |
| --- | --- |
| Chung | AWS_REGION, DEPLOY_ENABLED |
| Terraform | AWS_TERRAFORM_ROLE_ARN, ADMIN_EMAIL, ALARM_EMAIL, TF_STATE_BUCKET, TF_LOCK_TABLE; TF_STATE_REGION tùy chọn |
| Backend | AWS_DEPLOY_ROLE_ARN, ECR_REPOSITORY, IMAGE_TAG_PARAMETER, ASG_NAME |
| Frontend | AWS_DEPLOY_ROLE_ARN, FRONTEND_BUCKET, CLOUDFRONT_DISTRIBUTION_ID |

ECR_REPOSITORY là tên repository, không phải URL. Đối chiếu các giá trị với outputs; role ARN lấy từ bootstrap. Backend/frontend workflow hiện cố định environment demo; Terraform workflow chọn demo hoặc prod. Bật DEPLOY_ENABLED=true khi sẵn sàng và nhập deploy/apply theo workflow_dispatch.

Backend dùng tag riêng từng build, script scripts/deploy_backend.py chờ rollout và phục hồi tag cũ nếu thất bại. Frontend upload asset trước index, giữ hashed assets cũ; không thêm --delete hoặc chạy publish thủ công đồng thời workflow.

Manual frontend build phải đặt VITE_API_URL=/api, VITE_WS_URL="" và VITE_MEDIA_BASE_URL="" để dùng CloudFront cùng origin, thay vì .env local. Lệnh upload nằm ở [Terraform README](../infra/terraform/README.md).

## Xác minh sau deploy

- HTTPS /api/status trả lời; đây không phải kiểm tra DB/Redis.
- ALB target health/readiness đạt; /actuator/health/readiness dùng nội bộ ALB/SSM, không được route public qua CloudFront.
- Đăng nhập, tạo sự kiện/upload S3, đặt/confirm vé và mở lại checkout.
- Admin overview/voucher/scanner, từ chối camera và fallback nhập mã.
- Hai client trên hai instance nhận WebSocket; không cho client tự publish trạng thái.
- Queue direct API được tính admission; worker invoke trả số row và có CloudWatch logs.
- Xác nhận email SNS. Load test chỉ chạy trên môi trường được phép, với BASE_URL đúng; không đảm bảo tự kích hoạt scaling/alarm nếu tải chưa đạt ngưỡng.

Không có STS/ECR/failover/load test AWS thật trong các kiểm tra local. Xem [RUNBOOK](RUNBOOK.md) cho rollback và destroy.

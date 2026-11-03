# AWS deployment (làm sau, chưa apply trong giai đoạn code)

Mục tiêu: deploy profile **Demo** trước, kiểm tra, rồi `terraform destroy`. Profile Production chỉ là code tham chiếu.

## 1. Chuẩn bị

- AWS account, region `ap-southeast-1`.
- Domain `sudothanh.me` đang ở Cloudflare.
- Subdomain `ticketrush.sudothanh.me` sẽ được delegate sang Route 53.
- Cài AWS CLI, Terraform 1.16+, Docker.
- Tạo AWS Budget alert trước khi apply.

## 2. DNS

1. Apply Terraform demo (sau khi bootstrap state).
2. Lấy output `route53_name_servers`.
3. Vào Cloudflare, tạo 4 bản ghi:

```text
Type: NS
Name: ticketrush
Value: <4 Route53 nameservers>
Proxy: DNS only
```

4. Chờ propagation, kiểm tra:

```bash
dig NS ticketrush.sudothanh.me +short
```

5. ACM validation và các record app nằm trong Route 53:
   - `ticketrush.sudothanh.me` → CloudFront
   - `origin.ticketrush.sudothanh.me` → ALB

Không bật Cloudflare proxy cho `ticketrush` hoặc `origin`.

## 3. Terraform

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply        # một lần, tạo state bucket + DynamoDB lock + OIDC role

cd ../envs/demo
cp terraform.tfvars.example terraform.tfvars
# sửa domain, email alarm, admin email
terraform init
terraform plan
terraform apply
```

Sau apply, cấu hình GitHub repository variables:

```text
AWS_REGION
AWS_DEPLOY_ROLE_ARN
AWS_TERRAFORM_ROLE_ARN
ECR_REPOSITORY
IMAGE_TAG_PARAMETER
ASG_NAME
FRONTEND_BUCKET
CLOUDFRONT_DISTRIBUTION_ID
DEPLOY_ENABLED=true   # chỉ bật khi thực sự muốn deploy
```

## 4. Deploy app

- Backend: GitHub Actions `deploy-backend` (manual, gated).
- Frontend: GitHub Actions `deploy-frontend` (manual, gated).
- Hoặc build/push thủ công theo output Terraform.

## 5. Kiểm tra

```bash
curl https://ticketrush.sudothanh.me/api/status
curl https://ticketrush.sudothanh.me/actuator/health/readiness
```

Kiểm tra:

- SPA deep link `/event/...` không 404.
- Upload ảnh qua presigned S3.
- WebSocket qua CloudFront hoạt động > 10 phút (heartbeat).
- Hai browser nhận update ghế qua hai instance.
- ASG scale-out khi load test.
- Alarm SNS gửi email.

## 6. Destroy

Xem [RUNBOOK.md](RUNBOOK.md). Demo profile được cấu hình để destroy sạch.

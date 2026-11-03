# TicketRush infrastructure (Terraform)

Terraform scaffold for the TicketRush Spring Boot + React application.

> **Status:** code only. Nothing in this directory has been applied to AWS by the
> author. `envs/prod` is included for module validation and must **not** be
> applied as part of the student/demo project.

## Architecture

```
Browser
  │  HTTPS (ticketrush.sudothanh.me)
  ▼
CloudFront (ACM us-east-1, WAF optional, SPA function, security headers)
  ├── /*        → private S3 frontend bucket (OAC)
  ├── /api/*    → ALB (caching disabled, all viewer headers/query strings)
  ├── /ws*      → ALB (WebSocket, caching disabled)
  └── /media/*  → private S3 media bucket (OAC)

Route 53 zone: ticketrush.sudothanh.me (delegated from Cloudflare)
  ├── ticketrush      A/AAAA → CloudFront
  ├── origin.ticketrush A/AAAA → ALB
  └── ACM DNS validation records

VPC 10.0.0.0/16, 2 AZs
  ├── public  10.0.0.0/24, 10.0.1.0/24   (ALB, NAT, IGW)
  ├── app     10.0.10.0/24, 10.0.11.0/24 (ASG, no public IP)
  └── data    10.0.20.0/24, 10.0.21.0/24 (RDS, ElastiCache, no internet route)

Demo:   1 NAT, public ALB + CloudFront prefix list, ASG 2–4 × t3.small,
        RDS PostgreSQL 16 Multi-AZ db.t4g.micro, Redis 7 primary/replica.
Prod:   2 NAT, private ALB + CloudFront VPC origin, WAF, RDS Proxy,
        ASG 3–10, optional interface endpoints.
```

The ALB listener defaults to a 403 response. A listener rule forwards only
requests that include the `X-Origin-Verify` header. Terraform generates that
secret, stores it as a SecureString in SSM, and injects it into the CloudFront
origin. EC2 user data never contains secrets.

## Layout

```
infra/terraform/
  bootstrap/          # one-time S3 state bucket, DynamoDB lock table, GitHub OIDC
  modules/
    network/          # VPC, subnets, routes, NAT, VPC endpoints
    security/         # security groups, EC2 IAM role/profile
    data/             # RDS, RDS Proxy, ElastiCache, Secrets Manager
    edge/             # ALB, ACM, Route 53, S3, CloudFront, WAF
    compute/          # ECR, SSM image tag, launch template, ASG, user data
    observability/    # SNS, alarms, dashboard
  envs/demo/          # complete, destroy-friendly demo
  envs/prod/          # production feature flags, not applied by default
  backend.tf.example
  Makefile
  README.md
```

`edge` owns the ALB and DNS so the certificates can be created and validated in
the same module as the CloudFront distribution. This avoids a module dependency
cycle (ALB certificate ← DNS zone ← CloudFront ← ALB).

## Provider versions

- Terraform `>= 1.6.0` (validated with Terraform 1.16.6)
- AWS provider `~> 6.17`
- Random provider `~> 3.6`

`aws_cloudfront_vpc_origin` was introduced in AWS provider **v6.17.0**. The
constraint is therefore `~> 6.17` (>= 6.17.0, < 7.0.0). The prod VPC origin
block is controlled by `enable_vpc_origin`; keep the provider at 6.17 or newer
when enabling it.

## Prerequisites

- AWS credentials for the target sandbox account
- Terraform 1.6+
- A Cloudflare-managed `sudothanh.me` zone (or change `domain_name`)
- Docker for building the backend image
- An email address for CloudWatch alarms

## 1. Bootstrap once

```bash
cd "$(git rev-parse --show-toplevel)"
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# Set state_bucket_name, github_org and github_repo.
terraform init
terraform apply
```

Save the outputs:

```bash
terraform output state_bucket
terraform output lock_table
terraform output github_deploy_role_arn
```

See `bootstrap/README.md` for OIDC import notes.

## 2. Configure the demo

```bash
cd "$(git rev-parse --show-toplevel)"
cd infra/terraform/envs/demo
cp terraform.tfvars.example terraform.tfvars
# Set admin_email and alarm_email (and domain/subdomain if needed).

# Optional: enable remote state.
cp ../../backend.tf.example backend.tf
# Fill in bucket/key/dynamodb_table, then:
terraform init -migrate-state

# Without remote state:
terraform init -backend=false
```

## 3. Create the Route 53 zone first (DNS delegation)

The ACM certificates cannot validate until the delegated subdomain resolves to
the Route 53 zone. Apply **only the zone** first:

```bash
cd "$(git rev-parse --show-toplevel)"
cd infra/terraform/envs/demo
terraform apply -target=module.edge.aws_route53_zone.this
terraform output route53_name_servers

# If the output is not shown after a targeted apply:
# terraform state show module.edge.aws_route53_zone.this
```

In **Cloudflare → sudothanh.me → DNS**, add one NS record per Route 53 name
server:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| NS | `ticketrush` | `ns-xxxx.awsdns-xx.com` | DNS only |
| NS | `ticketrush` | `ns-xxxx.awsdns-xx.net` | DNS only |
| NS | `ticketrush` | `ns-xxxx.awsdns-xx.org` | DNS only |
| NS | `ticketrush` | `ns-xxxx.awsdns-xx.co.uk` | DNS only |

Important:

- `sudothanh.me` stays at Cloudflare. Do **not** change its apex NS records.
- Remove any existing `A`, `AAAA` or `CNAME` record named `ticketrush` at
  Cloudflare before delegating; an NS record cannot coexist with those.
- Cloudflare does not proxy NS records. The proxy toggle does not apply.
- Wait for propagation before the full apply (usually 5–15 minutes):

```bash
dig +short NS ticketrush.sudothanh.me
```

The answer must list the four Route 53 name servers.

## 4. Apply the demo

```bash
cd "$(git rev-parse --show-toplevel)"
cd infra/terraform/envs/demo
terraform apply
```

This creates the VPC, RDS, Redis, ALB, CloudFront, WAF-disabled edge, ASG,
alarms and the Route 53 validation/alias records. The first apply can take
20–40 minutes because RDS, ElastiCache, CloudFront and ACM validation are slow.

Useful outputs:

```bash
terraform output application_url
terraform output route53_name_servers
terraform output ecr_repository_url
terraform output image_tag_parameter_name
terraform output frontend_bucket_name
terraform output cloudfront_distribution_id
terraform output admin_password_secret_name
```

Read the generated admin password only when needed:

```bash
aws secretsmanager get-secret-value \
  --secret-id "$(terraform output -raw admin_password_secret_name)" \
  --query SecretString --output text
```

## 5. Deploy the backend image

The ASG starts with an empty ECR repository. Instances retry the image pull for
about five minutes; push an image and refresh the ASG.

```bash
cd "$(git rev-parse --show-toplevel)"

ECR_URL=$(terraform -chdir=infra/terraform/envs/demo output -raw ecr_repository_url)
TAG=$(git rev-parse --short HEAD)

aws ecr get-login-password --region ap-southeast-1 \
  | docker login --username AWS --password-stdin "${ECR_URL%%/*}"

docker build -t "$ECR_URL:$TAG" ./backend
docker push "$ECR_URL:$TAG"

aws ssm put-parameter \
  --name "$(terraform -chdir=infra/terraform/envs/demo output -raw image_tag_parameter_name)" \
  --value "$TAG" \
  --overwrite

aws autoscaling start-instance-refresh \
  --auto-scaling-group-name "$(terraform -chdir=infra/terraform/envs/demo output -raw autoscaling_group_name)" \
  --preferences '{"MinHealthyPercentage":50,"InstanceWarmup":120}'
```

New instances read the tag from SSM at boot, fetch DB/Redis/JWT/admin secrets
from Secrets Manager, log in to ECR, and start the container with the `awslogs`
driver. The image must listen on port 8080.

## 6. Deploy the frontend

```bash
cd "$(git rev-parse --show-toplevel)"

cd frontend
npm ci
npm run build
cd ..

aws s3 sync frontend/dist "s3://$(terraform -chdir=infra/terraform/envs/demo output -raw frontend_bucket_name)" --delete

aws cloudfront create-invalidation \
  --distribution-id "$(terraform -chdir=infra/terraform/envs/demo output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

## Destroy the demo

The demo profile is destroy-friendly:

- RDS `skip_final_snapshot = true`, `deletion_protection = false`
- S3 buckets `force_destroy = true`
- Secrets `recovery_window_in_days = 0`
- ECR `force_delete = true`
- ALB deletion protection off
- Route 53 zone `force_destroy = true`

```bash
cd "$(git rev-parse --show-toplevel)"
cd infra/terraform/envs/demo
terraform destroy
```

Notes:

- CloudFront deletion can take 10–20 minutes.
- If the demo was ever changed to enable ALB deletion protection, disable it
  before destroying.
- After destroy, remove the four NS records for `ticketrush` from Cloudflare.
  The delegation is manual and Terraform cannot remove it.
- If remote state is enabled, destroy the bootstrap stack separately only when
  you no longer need the state bucket.

## Production profile — do not apply

`envs/prod` exists to prove the same modules work with production flags. It is
not part of the demo workflow. If applied, it creates:

- 2 NAT gateways
- Private ALB + CloudFront VPC origin
- WAF WebACL in us-east-1 with managed rules and rate limiting
- RDS Proxy between the application and PostgreSQL
- ASG 3–10 with a larger instance type
- Optional interface VPC endpoints (S3 gateway endpoint always on)
- RDS deletion protection, no final-snapshot skip, 30-day secret recovery,
  non-force-destroy S3/ECR

`enable_shield_advanced`, `enable_aws_backup`, `enable_cloudtrail`,
`enable_guardduty` and `enable_config` are **placeholders** that default to
false. No resources are created for them.

Production destruction requires manual steps (disable RDS/ALB deletion
protection, empty buckets, force-delete ECR). Do not run `terraform destroy` in
prod casually.

## Local validation

No AWS API calls are needed:

```bash
cd infra/terraform
terraform fmt -recursive .

cd envs/demo
terraform init -backend=false
terraform validate

cd ../prod
terraform init -backend=false
terraform validate

cd ../../bootstrap
terraform init -backend=false
terraform validate
```

Or use the Makefile:

```bash
cd infra/terraform
make fmt
make check
```

## Operational notes

- **Origin protection:** the ALB SG allows only the CloudFront origin-facing
  managed prefix list (demo) or VPC CIDR (prod VPC origin). The listener rule
  additionally requires `X-Origin-Verify`.
- **S3 access:** both buckets block public access and are readable only by this
  CloudFront distribution through OAC. Browser uploads use presigned PUT URLs
  and the media bucket CORS policy.
- **SPA routing:** a CloudFront Function rewrites extension-less paths to
  `index.html`. Custom distribution-wide error responses are intentionally not
  used, so `/api/*` 403/404 responses are not masked.
- **Health checks:** ALB target group uses `/actuator/health/readiness`, which
  Spring Boot exposes with database readiness.
- **Logs:** the container uses the `awslogs` driver and the log group created by
  the compute module (`/ticketrush/demo/backend`).
- **Alarms:** ALB 5xx, target response time, unhealthy hosts, ASG CPU, RDS CPU
  and Redis CPU publish to SNS with an optional email subscription. Confirm the
  SNS email subscription before relying on alerts.
- **Secrets:** only secret names are in user data. Secret values are read at
  boot through the instance role. The JWT, DB, Redis, admin and origin-verify
  secrets are all generated by Terraform.

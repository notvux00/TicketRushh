# ĐẶC TẢ KỸ THUẬT: AWS LAMBDA MAINTENANCE WORKER — TỰ PHỤC HỒI & DỌN RÁC HỆ THỐNG

* **Tên dự án:** TicketRush System
* **Phân hệ:** Infrastructure — Serverless Scheduled Maintenance
* **Trạng thái:** Technical Specification — Ready to Implement
* **Phiên bản:** 1.0.0
* **Ngày tạo:** 2026-11-16

---

## MỤC LỤC
1. [Tổng quan & Phân tích hiện trạng](#1-tổng-quan--phân-tích-hiện-trạng)
2. [Mô tả tính năng chi tiết](#2-mô-tả-tính-năng-chi-tiết)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Danh sách file cần tạo & chỉnh sửa](#4-danh-sách-file-cần-tạo--chỉnh-sửa)
5. [Triển khai mã nguồn Lambda (Python)](#5-triển-khai-mã-nguồn-lambda-python)
6. [Triển khai Terraform Module](#6-triển-khai-terraform-module)
7. [Tích hợp vào Demo Environment](#7-tích-hợp-vào-demo-environment)
8. [Cập nhật Security Module (Lambda SG)](#8-cập-nhật-security-module-lambda-sg)
9. [Kiểm thử](#9-kiểm-thử)
10. [Tiêu chuẩn hoàn thành (Definition of Done)](#10-tiêu-chuẩn-hoàn-thành-definition-of-done)

---

## 1. TỔNG QUAN & PHÂN TÍCH HIỆN TRẠNG

### 1.1. Lỗ hổng hiện tại

Hệ thống TicketRush hiện có kiến trúc 2 lớp giữ ghế: **Redis TTL (10 phút)** làm hot-path và **`RedisKeyExpirationListener`** lắng nghe sự kiện hết hạn để dọn dẹp. Tuy nhiên tồn tại 3 lỗ hổng nghiêm trọng:

#### Lỗ hổng 1: Đơn hàng PENDING bị treo vĩnh viễn (Abandoned Carts)
- **Vấn đề:** Khi khách vào trang thanh toán (`CheckoutPage`) rồi tắt trình duyệt, đơn hàng vẫn mang trạng thái `PENDING` trong bảng `orders`. Hệ thống hiện chỉ chuyển sang `EXPIRED` theo cơ chế **Lazy Evaluation**: khi user quay lại gọi API `getSession()` hoặc `confirmSession()`.
- **File liên quan:** [`CheckoutService.java`](../backend/src/main/java/com/ticketrush/service/CheckoutService.java) — dòng 324–326 (`getUserOrder`) và dòng 330–331 (`isExpired`).
- **Hậu quả:** Nếu khách không bao giờ quay lại, đơn hàng sẽ là "rác" trong database, làm sai lệch các thống kê doanh thu trên Admin Dashboard.

#### Lỗ hổng 2: Ghế bị kẹt trạng thái LOCKED (Phantom Seat Lock)
- **Vấn đề:** Redis Key Expiration dựa trên cơ chế Pub/Sub (`__keyevent@*__:expired`), là fire-and-forget. Nếu xảy ra sự cố mạng, Redis failover, hoặc tất cả các instance backend đều đang restart tại thời điểm key hết hạn, sự kiện expiration sẽ bị mất gói tin. Kết quả: key Redis đã xoá nhưng bản ghi `seats` trong PostgreSQL vẫn giữ `status = 'LOCKED'` và `locked_at` vĩnh viễn.
- **File liên quan:** [`RedisKeyExpirationListener.java`](../backend/src/main/java/com/ticketrush/service/RedisKeyExpirationListener.java) — chỉ gửi WebSocket broadcast, **không cập nhật trường `status`/`locked_at` trong bảng `seats` PostgreSQL**.
- **Hậu quả:** Ghế bị "ma" — khách nào cũng thấy ghế đang bị giữ (LOCKED) mặc dù thực tế không ai đang giữ.

> [!IMPORTANT]
> Lưu ý quan trọng: `RedisKeyExpirationListener.handleSeatLockExpiry()` hiện tại **chỉ broadcast WebSocket** để frontend hiển thị ghế là AVAILABLE. Nó **KHÔNG ghi ngược lại bảng `seats` trong PostgreSQL** (không UPDATE `status` = 'AVAILABLE', không xoá `locked_at`/`locked_by`). Điều này có nghĩa là nếu người dùng mới vào trang booking sau khi key Redis đã hết hạn, dữ liệu load từ DB vẫn hiển thị ghế đó là LOCKED.

#### Lỗ hổng 3: Voucher hết hạn nhưng vẫn active
- **Vấn đề:** Bảng `vouchers` có trường `end_date` và `total_quantity`, nhưng không có cơ chế tự động chuyển `active = false` khi quá hạn hoặc hết số lượng. Hệ thống chỉ kiểm tra điều kiện hết hạn **tại thời điểm khách áp mã** (`applyVoucher()` dòng 202–211).
- **File liên quan:** [`CheckoutService.java`](../backend/src/main/java/com/ticketrush/service/CheckoutService.java) — dòng 202–211 (validation logic trong `applyVoucher`).
- **Hậu quả:** Admin nhìn thấy voucher `active = true` trong dashboard nhưng thực tế nó đã hết hạn. API `getActiveVouchers()` trả về voucher quá hạn cho frontend hiển thị, tạo trải nghiệm xấu cho người dùng.

### 1.2. Giải pháp: Defense-in-Depth Architecture

Bổ sung lớp bảo vệ thứ hai (**Reconciliation Layer**) bằng AWS Lambda chạy định kỳ, đóng vai trò **Safety Net** cho toàn bộ hệ thống:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   KIẾN TRÚC BẢO VỆ 2 LỚP                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Lớp 1 (Hot-path — Realtime):                                      │
│    Redis TTL 10 phút + KeyExpirationListener + WebSocket            │
│    → Xử lý 99% trường hợp bình thường                              │
│                                                                     │
│  Lớp 2 (Cold-path — Reconciliation — MỚI):                         │
│    AWS Lambda chạy mỗi 15 phút                                     │
│    → Quét database, sửa chữa mọi trạng thái bất nhất               │
│    → Safety net cho 1% trường hợp Lớp 1 thất bại                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. MÔ TẢ TÍNH NĂNG CHI TIẾT

### 2.1. Tổng quan Lambda Function

| Thuộc tính | Giá trị |
| :--- | :--- |
| **Tên hàm** | `ticketrush-{env}-maintenance-worker` |
| **Runtime** | Python 3.12 |
| **Handler** | `maintenance.handler` |
| **Bộ nhớ** | 128 MB |
| **Timeout** | 30 giây |
| **Trigger** | AWS EventBridge Scheduler — `rate(15 minutes)` |
| **Vị trí mạng** | Đặt trong VPC, sử dụng `app_subnet_ids` (private subnet có NAT Gateway) |
| **Security Group** | Security Group riêng, chỉ mở egress đến DB Security Group port 5432 và HTTPS 443 (Secrets Manager) |
| **Chi phí** | ~2.880 invocations/tháng × 200ms × 128 MB = **miễn phí 100%** (nằm trong Free Tier: 1M requests + 400.000 GB-seconds/tháng) |

### 2.2. Ba tác vụ (Jobs) của Lambda

#### Job 1: Expire Stale Orders (Hủy đơn hàng bỏ quên)

```sql
UPDATE orders
SET    status = 'EXPIRED'
WHERE  status = 'PENDING'
  AND  expires_at < NOW()
RETURNING id;
```

- **Điều kiện:** Đơn hàng `PENDING` có `expires_at` đã qua thời điểm hiện tại.
- **Hành vi:** Chuyển trạng thái sang `EXPIRED`.
- **Lưu ý:** Lambda KHÔNG xoá ticket drafts vì bảng `tickets` phụ thuộc FK vào `orders`. Việc dọn vé rác sẽ để cho cơ chế `createSession()` đã có sẵn xử lý (dòng 80–87 trong `CheckoutService.java`).
- **Bảng đụng:** `orders`
- **Entity liên quan:** [`Order.java`](../backend/src/main/java/com/ticketrush/model/entity/Order.java) — trường `status`, `expiresAt`.

#### Job 2: Reap Stale Seat Locks (Giải phóng ghế bị kẹt)

```sql
UPDATE seats
SET    status    = 'AVAILABLE',
       locked_at = NULL,
       locked_by = NULL
WHERE  status    = 'LOCKED'
  AND  locked_at < NOW() - INTERVAL '15 minutes'
RETURNING id;
```

- **Điều kiện:** Ghế có `status = 'LOCKED'` và `locked_at` cách thời điểm hiện tại hơn 15 phút (lớn hơn Redis TTL 10 phút, cho phép thêm 5 phút buffer).
- **Hành vi:** Reset ghế về trạng thái `AVAILABLE` và xóa thông tin khóa.
- **Vì sao 15 phút chứ không phải 10 phút?** Redis TTL là 10 phút. Dùng 15 phút để tránh race condition: Lambda không nên giải phóng ghế đang được Redis quản lý hợp lệ. Chỉ giải phóng những ghế mà Redis đã quá hạn 5 phút mà Lớp 1 vẫn chưa dọn được.
- **Bảng đụng:** `seats`
- **Entity liên quan:** [`Seat.java`](../backend/src/main/java/com/ticketrush/model/entity/Seat.java) — trường `status`, `lockedAt`, `lockedByUser`.

#### Job 3: Deactivate Expired Vouchers (Tắt voucher hết hạn)

```sql
UPDATE vouchers
SET    active = false
WHERE  active = true
  AND  (end_date < NOW() OR used_quantity >= total_quantity)
RETURNING id, code;
```

- **Điều kiện:** Voucher đang `active = true` nhưng đã quá `end_date` hoặc đã hết lượt sử dụng.
- **Hành vi:** Chuyển `active = false`.
- **Bảng đụng:** `vouchers`
- **Entity liên quan:** [`Voucher.java`](../backend/src/main/java/com/ticketrush/model/entity/Voucher.java) — trường `active`, `endDate`, `usedQuantity`, `totalQuantity`.

---

## 3. KIẾN TRÚC HỆ THỐNG

```
                     ┌───────────────────────┐
                     │  AWS EventBridge       │
                     │  rate(15 minutes)      │
                     └───────────┬────────────┘
                                 │ Trigger
                                 ▼
                     ┌───────────────────────┐
                     │  AWS Lambda            │
                     │  maintenance-worker    │
                     │  (Python 3.12)         │
                     │  128 MB / 30s timeout  │
                     └──────┬────────┬────────┘
                            │        │
                  ┌─────────┘        └──────────┐
                  ▼                              ▼
     ┌────────────────────┐        ┌─────────────────────────┐
     │  AWS Secrets Manager│        │  Amazon RDS PostgreSQL  │
     │  {prefix}/db        │        │  (Private Subnet)       │
     │                    │        │                         │
     │  { username, pass, │───────▶│  orders                 │
     │    dbname }        │        │  seats                  │
     └────────────────────┘        │  vouchers               │
                                   └─────────────────────────┘
```

### Luồng xử lý:
1. **EventBridge** kích hoạt Lambda mỗi 15 phút.
2. Lambda đọc **Secrets Manager** để lấy credentials PostgreSQL (`username`, `password`, `dbname`).
3. Lambda kết nối trực tiếp đến **RDS PostgreSQL** (thông qua private subnet cùng VPC).
4. Thực thi tuần tự 3 câu SQL: expire orders → reap seats → deactivate vouchers.
5. Ghi log kết quả ra **CloudWatch Logs** (tự động, không cần cấu hình thêm).

---

## 4. DANH SÁCH FILE CẦN TẠO & CHỈNH SỬA

### 4.1. File TẠO MỚI

| # | File | Mô tả |
| :---: | :--- | :--- |
| 1 | `infra/lambda/maintenance/maintenance.py` | Code Python chính cho Lambda handler |
| 2 | `infra/terraform/modules/maintenance_worker/main.tf` | Terraform module: IAM, Lambda, EventBridge |
| 3 | `infra/terraform/modules/maintenance_worker/variables.tf` | Input variables cho module |
| 4 | `infra/terraform/modules/maintenance_worker/outputs.tf` | Output values |
| 5 | `infra/terraform/modules/maintenance_worker/versions.tf` | Provider requirements |

### 4.2. File CHỈNH SỬA

| # | File | Thay đổi |
| :---: | :--- | :--- |
| 1 | `infra/terraform/modules/security/main.tf` | Thêm Security Group `lambda` với egress rule đến `db_security_group_id` port 5432 và HTTPS 443 |
| 2 | `infra/terraform/modules/security/outputs.tf` | Thêm output `lambda_security_group_id` |
| 3 | `infra/terraform/modules/security/variables.tf` | Không cần thay đổi (đã có `vpc_id`, `vpc_cidr`) |
| 4 | `infra/terraform/modules/data/main.tf` | Thêm ingress rule cho DB SG: cho phép Lambda SG kết nối port 5432 |
| 5 | `infra/terraform/envs/demo/main.tf` | Thêm block `module "maintenance_worker"` để gọi module mới |
| 6 | `infra/terraform/envs/demo/outputs.tf` | Thêm output `maintenance_worker_function_name` |

### 4.3. File KHÔNG thay đổi

Backend Java, Frontend React và các migration SQL đều **KHÔNG bị đụng**. Lambda hoạt động hoàn toàn độc lập, chỉ đọc/ghi trực tiếp PostgreSQL bằng SQL thuần.

---

## 5. TRIỂN KHAI MÃ NGUỒN LAMBDA (PYTHON)

### 5.1. File: `infra/lambda/maintenance/maintenance.py`

```python
"""
TicketRush Maintenance Worker — AWS Lambda handler.
Runs every 15 minutes via EventBridge to reconcile stale data.

Jobs:
  1. Expire PENDING orders past their expires_at.
  2. Reap seats stuck in LOCKED for > 15 min (safety net for Redis TTL misses).
  3. Deactivate vouchers past end_date or fully used.
"""

import json
import logging
import os

import boto3
import psycopg2  # Supplied via Lambda layer or bundled in zip

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Environment variables (injected by Terraform) ──────────────────
DB_SECRET_NAME = os.environ["DB_SECRET_NAME"]
DB_HOST = os.environ["DB_HOST"]
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
REGION = os.environ.get("AWS_REGION", "ap-southeast-1")

# ── SQL statements ─────────────────────────────────────────────────
SQL_EXPIRE_ORDERS = """
UPDATE orders
SET    status = 'EXPIRED'
WHERE  status = 'PENDING'
  AND  expires_at < NOW()
"""

SQL_REAP_SEATS = """
UPDATE seats
SET    status    = 'AVAILABLE',
       locked_at = NULL,
       locked_by = NULL
WHERE  status    = 'LOCKED'
  AND  locked_at < NOW() - INTERVAL '15 minutes'
"""

SQL_DEACTIVATE_VOUCHERS = """
UPDATE vouchers
SET    active = false
WHERE  active = true
  AND  (end_date < NOW() OR used_quantity >= total_quantity)
"""

# ── Helpers ────────────────────────────────────────────────────────

_secrets_client = boto3.client("secretsmanager", region_name=REGION)


def _get_db_credentials() -> dict:
    """Retrieve PostgreSQL credentials from AWS Secrets Manager."""
    resp = _secrets_client.get_secret_value(SecretId=DB_SECRET_NAME)
    return json.loads(resp["SecretString"])


def _connect():
    """Return a psycopg2 connection to the TicketRush database."""
    creds = _get_db_credentials()
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"],
        sslmode="require",
        connect_timeout=10,
    )


# ── Handler ────────────────────────────────────────────────────────

def handler(event, context):
    """Lambda entry point — called by EventBridge every 15 minutes."""

    results = {}

    conn = _connect()
    try:
        with conn:
            with conn.cursor() as cur:
                # Job 1: Expire stale orders
                cur.execute(SQL_EXPIRE_ORDERS)
                results["expired_orders"] = cur.rowcount

                # Job 2: Reap phantom seat locks
                cur.execute(SQL_REAP_SEATS)
                results["reaped_seats"] = cur.rowcount

                # Job 3: Deactivate expired vouchers
                cur.execute(SQL_DEACTIVATE_VOUCHERS)
                results["deactivated_vouchers"] = cur.rowcount

        # conn.__exit__ commits automatically when no exception is raised.
    finally:
        conn.close()

    logger.info("Maintenance completed: %s", json.dumps(results))
    return {"statusCode": 200, "body": results}
```

### 5.2. Thư viện phụ thuộc

- **`psycopg2`**: Dùng **Lambda Layer** có sẵn trên cộng đồng (ví dụ: `arn:aws:lambda:ap-southeast-1:770693421928:layer:Klayers-p312-psycopg2-binary:3`) hoặc tự đóng gói `psycopg2-binary` vào zip cùng code.
- **`boto3`**: Có sẵn trong runtime Lambda Python, không cần cài thêm.

> [!NOTE]
> Nếu muốn tự đóng gói: tạo thư mục `infra/lambda/maintenance/`, chạy `pip install psycopg2-binary -t .`, rồi zip toàn bộ thư mục.
> Nếu dùng Lambda Layer: Terraform sẽ khai báo `layers = [var.psycopg2_layer_arn]`.

---

## 6. TRIỂN KHAI TERRAFORM MODULE

### 6.1. File: `infra/terraform/modules/maintenance_worker/main.tf`

```hcl
data "aws_region" "current" {}

locals {
  function_name = "${var.name_prefix}-maintenance-worker"
  log_group     = "/aws/lambda/${local.function_name}"

  tags = merge(var.tags, {
    Component = "maintenance-worker"
  })
}

# ── Package Lambda code ────────────────────────────────────────────

data "archive_file" "lambda" {
  type        = "zip"
  source_file = "${path.module}/../../../lambda/maintenance/maintenance.py"
  output_path = "${path.module}/.build/maintenance.zip"
}

# ── IAM Role ───────────────────────────────────────────────────────

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = local.function_name
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  tags               = local.tags
}

# VPC access (ENIs in the private subnets)
resource "aws_iam_role_policy_attachment" "vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Read database secret
data "aws_iam_policy_document" "lambda" {
  statement {
    sid    = "ReadDatabaseSecret"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [var.db_secret_arn]
  }

  statement {
    sid       = "DecryptSecret"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${data.aws_region.current.name}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

# ── CloudWatch Log Group ──────────────────────────────────────────

resource "aws_cloudwatch_log_group" "lambda" {
  name              = local.log_group
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

# ── Lambda Function ──────────────────────────────────────────────

resource "aws_lambda_function" "maintenance" {
  function_name = local.function_name
  description   = "TicketRush scheduled maintenance: expire orders, reap seats, deactivate vouchers"
  role          = aws_iam_role.lambda.arn

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  handler          = "maintenance.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 128

  layers = var.psycopg2_layer_arn != "" ? [var.psycopg2_layer_arn] : []

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      DB_SECRET_NAME = var.db_secret_name
      DB_HOST        = var.db_host
      DB_PORT        = tostring(var.db_port)
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda,
    aws_iam_role_policy_attachment.vpc_access,
    aws_cloudwatch_log_group.lambda,
  ]

  tags = local.tags
}

# ── EventBridge Schedule ─────────────────────────────────────────

resource "aws_cloudwatch_event_rule" "every_15_min" {
  name                = "${local.function_name}-trigger"
  description         = "Trigger maintenance worker every 15 minutes"
  schedule_expression = "rate(15 minutes)"
  tags                = local.tags
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule = aws_cloudwatch_event_rule.every_15_min.name
  arn  = aws_lambda_function.maintenance.arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.maintenance.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_15_min.arn
}
```

### 6.2. File: `infra/terraform/modules/maintenance_worker/variables.tf`

```hcl
variable "name_prefix" {
  description = "Resource name prefix (e.g. ticketrush-demo)."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for Lambda VPC placement."
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID for the Lambda function."
  type        = string
}

variable "db_secret_name" {
  description = "Secrets Manager secret name for DB credentials."
  type        = string
}

variable "db_secret_arn" {
  description = "Secrets Manager secret ARN for DB credentials."
  type        = string
}

variable "db_host" {
  description = "RDS endpoint hostname."
  type        = string
}

variable "db_port" {
  description = "RDS port."
  type        = number
  default     = 5432
}

variable "psycopg2_layer_arn" {
  description = "ARN of a Lambda layer providing psycopg2-binary. Leave empty to bundle in zip."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Common resource tags."
  type        = map(string)
  default     = {}
}
```

### 6.3. File: `infra/terraform/modules/maintenance_worker/outputs.tf`

```hcl
output "function_name" {
  description = "Lambda function name."
  value       = aws_lambda_function.maintenance.function_name
}

output "function_arn" {
  description = "Lambda function ARN."
  value       = aws_lambda_function.maintenance.arn
}

output "log_group_name" {
  description = "CloudWatch log group for the maintenance worker."
  value       = aws_cloudwatch_log_group.lambda.name
}
```

### 6.4. File: `infra/terraform/modules/maintenance_worker/versions.tf`

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.17"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}
```

---

## 7. TÍCH HỢP VÀO DEMO ENVIRONMENT

### 7.1. Chỉnh sửa `infra/terraform/envs/demo/main.tf`

Thêm block sau vào cuối file, **sau** `module "observability"`:

```hcl
module "maintenance_worker" {
  source = "../../modules/maintenance_worker"

  name_prefix = local.name_prefix

  subnet_ids               = module.network.app_subnet_ids
  lambda_security_group_id = module.security.lambda_security_group_id

  db_secret_name = module.data.db_secret_name
  db_secret_arn  = module.data.db_secret_arn
  db_host        = module.data.db_address
  db_port        = module.data.db_port

  log_retention_days = var.log_retention_days

  tags = local.common_tags
}
```

### 7.2. Chỉnh sửa `infra/terraform/envs/demo/outputs.tf`

Thêm ở cuối file:

```hcl
output "maintenance_worker_function_name" {
  description = "Lambda function name for the maintenance worker."
  value       = module.maintenance_worker.function_name
}
```

---

## 8. CẬP NHẬT SECURITY MODULE (LAMBDA SG)

### 8.1. Thêm vào `infra/terraform/modules/security/main.tf`

Thêm **sau** block `aws_security_group "redis"` (khoảng dòng 220):

```hcl
# ── Lambda maintenance worker ─────────────────────────────────────

resource "aws_security_group" "lambda" {
  name        = "${var.name_prefix}-lambda"
  description = "Lambda maintenance worker"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-lambda"
  })
}

resource "aws_vpc_security_group_egress_rule" "lambda_to_db" {
  security_group_id            = aws_security_group.lambda.id
  description                  = "PostgreSQL from Lambda maintenance worker"
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "lambda_https" {
  security_group_id = aws_security_group.lambda.id
  description       = "HTTPS for Secrets Manager API calls"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "lambda_dns_tcp" {
  security_group_id = aws_security_group.lambda.id
  description       = "VPC DNS over TCP"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 53
  to_port           = 53
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "lambda_dns_udp" {
  security_group_id = aws_security_group.lambda.id
  description       = "VPC DNS over UDP"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
}
```

### 8.2. Thêm vào `infra/terraform/modules/data/main.tf`

Thêm ingress rule cho DB Security Group (sau `aws_vpc_security_group_ingress_rule "db_from_proxy"`, khoảng dòng 173):

```hcl
resource "aws_vpc_security_group_ingress_rule" "db_from_lambda" {
  security_group_id            = var.db_security_group_id
  description                  = "PostgreSQL from Lambda maintenance worker"
  referenced_security_group_id = var.lambda_security_group_id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
```

> [!NOTE]
> Cần thêm variable `lambda_security_group_id` vào `modules/data/variables.tf` và truyền giá trị từ `envs/demo/main.tf` block `module "data"`.

### 8.3. Thêm vào `infra/terraform/modules/security/outputs.tf`

```hcl
output "lambda_security_group_id" {
  description = "Security group for the Lambda maintenance worker."
  value       = aws_security_group.lambda.id
}
```

### 8.4. Thêm vào `infra/terraform/modules/data/variables.tf`

```hcl
variable "lambda_security_group_id" {
  description = "Security group ID for the Lambda maintenance worker."
  type        = string
  default     = ""
}
```

### 8.5. Cập nhật `infra/terraform/envs/demo/main.tf` block `module "data"`

Thêm dòng sau vào block `module "data"`:

```hcl
  lambda_security_group_id = module.security.lambda_security_group_id
```

---

## 9. KIỂM THỬ

### 9.1. Kiểm thử Local (trên Docker Compose)

Tạo script `infra/lambda/maintenance/test_local.py` để chạy trực tiếp trên Docker Compose PostgreSQL (port 5432 localhost):

```python
"""
Quick smoke test: run the maintenance SQL directly against local Docker PostgreSQL.
Usage: python test_local.py
"""
import psycopg2

conn = psycopg2.connect(host="localhost", port=5432, dbname="ticketrush", user="postgres", password="postgres")
try:
    with conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE orders SET status='EXPIRED' WHERE status='PENDING' AND expires_at < NOW()")
            print(f"Expired orders: {cur.rowcount}")

            cur.execute("UPDATE seats SET status='AVAILABLE', locked_at=NULL, locked_by=NULL WHERE status='LOCKED' AND locked_at < NOW() - INTERVAL '15 minutes'")
            print(f"Reaped seats:   {cur.rowcount}")

            cur.execute("UPDATE vouchers SET active=false WHERE active=true AND (end_date < NOW() OR used_quantity >= total_quantity)")
            print(f"Deactivated vouchers: {cur.rowcount}")
finally:
    conn.close()
    print("Done.")
```

**Cách chạy:**
```bash
# Đảm bảo Docker Compose postgres đang chạy
docker compose up -d postgres
pip install psycopg2-binary
python infra/lambda/maintenance/test_local.py
```

### 9.2. Kiểm thử trên AWS (sau khi Terraform Apply)

```bash
# Gọi Lambda thủ công để kiểm tra
aws lambda invoke \
  --function-name ticketrush-demo-maintenance-worker \
  --region ap-southeast-1 \
  /tmp/response.json

cat /tmp/response.json
# Expected: {"statusCode": 200, "body": {"expired_orders": 0, "reaped_seats": 0, "deactivated_vouchers": 0}}

# Kiểm tra log
aws logs tail /aws/lambda/ticketrush-demo-maintenance-worker --follow
```

### 9.3. Kiểm thử tích hợp (Integration Test Scenario)

1. **Chuẩn bị:** Tạo 1 đơn hàng PENDING với `expires_at = NOW() - INTERVAL '1 hour'` trực tiếp trong DB.
2. **Chạy Lambda** (hoặc chờ 15 phút để EventBridge tự kích hoạt).
3. **Kiểm tra:** Query bảng `orders` xác nhận đơn hàng đó đã chuyển sang `EXPIRED`.
4. **Lặp lại** tương tự cho ghế LOCKED quá hạn và voucher hết hạn.

---

## 10. TIÊU CHUẨN HOÀN THÀNH (DEFINITION OF DONE)

### 10.1. Code & Infrastructure

- [ ] File `infra/lambda/maintenance/maintenance.py` tồn tại và chứa đầy đủ handler với 3 câu SQL.
- [ ] Module Terraform `infra/terraform/modules/maintenance_worker/` tồn tại với đầy đủ 4 file: `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`.
- [ ] Security Group `lambda` được tạo trong module `security` với các egress rules: DB 5432, HTTPS 443, DNS 53.
- [ ] DB Security Group có ingress rule cho phép Lambda SG kết nối port 5432.
- [ ] `infra/terraform/envs/demo/main.tf` có block `module "maintenance_worker"` khai báo đầy đủ.
- [ ] `terraform validate` chạy thành công không lỗi trên thư mục `infra/terraform/envs/demo/`.

### 10.2. Kiểm thử Local

- [ ] Script `test_local.py` chạy thành công trên Docker Compose PostgreSQL local.
- [ ] Tạo 1 order PENDING quá hạn bằng SQL INSERT → chạy script → xác nhận order chuyển sang EXPIRED.
- [ ] Tạo 1 seat LOCKED với `locked_at` quá 15 phút bằng SQL INSERT → chạy script → xác nhận seat chuyển sang AVAILABLE.
- [ ] Tạo 1 voucher active với `end_date` trong quá khứ → chạy script → xác nhận voucher chuyển `active = false`.

### 10.3. Kiểm thử AWS (Sau khi Apply)

- [ ] `terraform apply` thành công không lỗi.
- [ ] Lambda function xuất hiện trong AWS Console (Lambda > Functions).
- [ ] EventBridge Rule xuất hiện trong AWS Console (EventBridge > Rules).
- [ ] `aws lambda invoke` trả về `statusCode: 200`.
- [ ] CloudWatch Logs hiển thị log `Maintenance completed: {...}`.

### 10.4. Không gây Side Effects

- [ ] Backend Java khởi động bình thường, không có lỗi liên quan đến migration hay schema.
- [ ] Frontend build thành công (`npm run build`).
- [ ] Toàn bộ unit test backend chạy pass (9/9 tests).
- [ ] `git status` sạch sau khi commit (không có file rác).

---

> [!TIP]
> **Điểm cộng kiến trúc khi trình bày:**
> *"Hệ thống của chúng em thiết kế theo nguyên tắc Defense-in-Depth: Redis xử lý realtime (Hot-path), AWS Lambda chạy định kỳ đóng vai trò Reconciliation Layer (Cold-path). Ngay cả khi Redis bị sự cố hay backend restart, Lambda sẽ tự động phát hiện và sửa chữa mọi trạng thái bất nhất trong vòng tối đa 15 phút."*

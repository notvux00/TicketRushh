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
  source_file = var.psycopg2_layer_arn != "" ? "${path.module}/../../../lambda/maintenance/maintenance.py" : null
  source_dir  = var.psycopg2_layer_arn == "" ? "${path.module}/../../../lambda/maintenance/.build/package" : null
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
      values   = ["secretsmanager.${data.aws_region.current.region}.amazonaws.com"]
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

  filename                       = data.archive_file.lambda.output_path
  source_code_hash               = data.archive_file.lambda.output_base64sha256
  handler                        = "maintenance.handler"
  runtime                        = "python3.12"
  timeout                        = 30
  memory_size                    = 128
  architectures                  = ["x86_64"]
  reserved_concurrent_executions = 1

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

  depends_on = [aws_lambda_permission.eventbridge]
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.maintenance.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_15_min.arn
}

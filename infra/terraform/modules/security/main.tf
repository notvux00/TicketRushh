data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  tags = merge(var.tags, {
    Component = "security"
  })
}

# Scaffold: add application, edge and database security groups and their rules.

# -----------------------------------------------------------------------------
# EC2 instance role
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.name_prefix}-ec2"
  description        = "TicketRush backend EC2 instance role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  statement {
    sid    = "ReadApplicationSecrets"
    effect = "Allow"

    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
    ]

    resources = [
      "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:${var.name_prefix}/*",
    ]
  }

  statement {
    sid       = "DecryptSecretsWithSecretsManagerKey"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${local.region}.amazonaws.com"]
    }
  }

  statement {
    sid    = "ReadDeploymentParameter"
    effect = "Allow"

    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]

    resources = [
      "arn:aws:ssm:${local.region}:${local.account_id}:parameter${var.config_prefix}/image-tag",
    ]
  }

  statement {
    sid    = "MediaBucketList"
    effect = "Allow"

    actions = ["s3:ListBucket"]

    resources = [
      "arn:aws:s3:::${var.media_bucket_prefix}*",
    ]
  }

  statement {
    sid    = "MediaObjectReadWrite"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = [
      "arn:aws:s3:::${var.media_bucket_prefix}*/*",
    ]
  }

  statement {
    sid    = "BackendLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
    ]

    resources = [
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/ticketrush/*",
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/ticketrush/*:*",
    ]
  }

  statement {
    sid       = "ApplicationMetrics"
    effect    = "Allow"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["TicketRush"]
    }
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "${var.name_prefix}-app"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.name_prefix}-ec2"
  role = aws_iam_role.app.name

  tags = local.tags
}

# Scaffold: add the maintenance worker security group and rules.

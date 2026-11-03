data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ec2_managed_prefix_list" "cloudfront_origin" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  tags = merge(var.tags, {
    Component = "security"
  })
}

# -----------------------------------------------------------------------------
# Security groups
# -----------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "CloudFront to ALB HTTPS only"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-alb"
  })
}

# Public (demo) ALB: only CloudFront origin-facing addresses may connect.
resource "aws_vpc_security_group_ingress_rule" "alb_from_cloudfront" {
  count = var.enable_vpc_origin ? 0 : 1

  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the CloudFront origin-facing prefix list"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin.id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

# Private (prod) ALB: CloudFront VPC origins place ENIs inside the VPC.
resource "aws_vpc_security_group_ingress_rule" "alb_from_vpc" {
  count = var.enable_vpc_origin ? 1 : 0

  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from CloudFront VPC origin ENIs"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward traffic and health checks to the application"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app"
  description = "Spring Boot application instances"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-app"
  })
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "Application port from the ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  description       = "AWS APIs (ECR, Secrets Manager, SSM, CloudWatch) through NAT or endpoints"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_dns_tcp" {
  security_group_id = aws_security_group.app.id
  description       = "VPC DNS over TCP"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 53
  to_port           = 53
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_dns_udp" {
  security_group_id = aws_security_group.app.id
  description       = "VPC DNS over UDP"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 53
  to_port           = 53
  ip_protocol       = "udp"
}

resource "aws_vpc_security_group_egress_rule" "app_ntp" {
  security_group_id = aws_security_group.app.id
  description       = "Amazon Time Sync Service"
  cidr_ipv4         = "169.254.169.123/32"
  from_port         = 123
  to_port           = 123
  ip_protocol       = "udp"
}

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-db"
  description = "PostgreSQL access from the application tier"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-db"
  })
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from application instances"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "rds_proxy" {
  name        = "${var.name_prefix}-rds-proxy"
  description = "RDS Proxy between the application and PostgreSQL"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-rds-proxy"
  })
}

resource "aws_vpc_security_group_ingress_rule" "proxy_from_app" {
  security_group_id            = aws_security_group.rds_proxy.id
  description                  = "PostgreSQL from application instances"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "proxy_to_db" {
  security_group_id            = aws_security_group.rds_proxy.id
  description                  = "PostgreSQL to the database"
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "db_from_proxy" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from RDS Proxy"
  referenced_security_group_id = aws_security_group.rds_proxy.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_to_db" {
  security_group_id            = aws_security_group.app.id
  description                  = "Direct PostgreSQL when RDS Proxy is disabled"
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_to_proxy" {
  security_group_id            = aws_security_group.app.id
  description                  = "PostgreSQL through RDS Proxy when enabled"
  referenced_security_group_id = aws_security_group.rds_proxy.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis"
  description = "Redis access from the application tier"
  vpc_id      = var.vpc_id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-redis"
  })
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_app" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis TLS from application instances"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_to_redis" {
  security_group_id            = aws_security_group.app.id
  description                  = "Redis TLS"
  referenced_security_group_id = aws_security_group.redis.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
}

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

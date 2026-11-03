data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region

  tags = merge(var.tags, {
    Component = "data"
  })
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

resource "random_password" "db" {
  length  = 40
  special = false
}

resource "random_password" "redis" {
  length  = 40
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "admin" {
  count   = var.admin_password == "" ? 1 : 0
  length  = 24
  special = false
}

locals {
  effective_admin_password = var.admin_password != "" ? var.admin_password : random_password.admin[0].result
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.name_prefix}/db"
  description             = "TicketRush PostgreSQL credentials"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id

  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
    dbname   = var.db_name
  })
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "${var.name_prefix}/redis"
  description             = "TicketRush ElastiCache auth token"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id

  secret_string = jsonencode({
    auth_token = random_password.redis.result
  })
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.name_prefix}/jwt"
  description             = "TicketRush JWT signing secret"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

resource "aws_secretsmanager_secret" "admin" {
  name                    = "${var.name_prefix}/admin"
  description             = "Initial TicketRush admin password"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "admin" {
  secret_id     = aws_secretsmanager_secret.admin.id
  secret_string = local.effective_admin_password
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL
# -----------------------------------------------------------------------------

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db"
  subnet_ids = var.data_subnet_ids

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-db"
  })
}

resource "aws_db_instance" "this" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage > 0 ? var.db_max_allocated_storage : null
  storage_type          = "gp3"
  storage_encrypted     = true

  multi_az                = var.db_multi_az
  publicly_accessible     = false
  vpc_security_group_ids  = [var.db_security_group_id]
  db_subnet_group_name    = aws_db_subnet_group.this.name
  backup_retention_period = var.db_backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${var.name_prefix}-final"

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-postgres"
  })
}

# -----------------------------------------------------------------------------
# RDS Proxy (production profile)
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "rds_proxy_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_proxy" {
  count = var.enable_rds_proxy ? 1 : 0

  name               = "${var.name_prefix}-rds-proxy"
  description        = "Allows RDS Proxy to read the TicketRush database secret"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume_role.json

  tags = local.tags
}

data "aws_iam_policy_document" "rds_proxy" {
  statement {
    sid       = "ReadDatabaseSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.db.arn]
  }

  statement {
    sid       = "DecryptDatabaseSecret"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${local.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "rds_proxy" {
  count = var.enable_rds_proxy ? 1 : 0

  name   = "${var.name_prefix}-rds-proxy"
  role   = aws_iam_role.rds_proxy[0].id
  policy = data.aws_iam_policy_document.rds_proxy.json
}

resource "aws_db_proxy" "this" {
  count = var.enable_rds_proxy ? 1 : 0

  name                   = "${var.name_prefix}-pg-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_subnet_ids         = var.data_subnet_ids
  vpc_security_group_ids = [var.rds_proxy_security_group_id]
  require_tls            = true
  idle_client_timeout    = 1800
  debug_logging          = false

  auth {
    auth_scheme = "SECRETS"
    description = "TicketRush PostgreSQL credentials"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db.arn
  }

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-pg-proxy"
  })

  depends_on = [aws_iam_role_policy.rds_proxy]
}

resource "aws_db_proxy_default_target_group" "this" {
  count = var.enable_rds_proxy ? 1 : 0

  db_proxy_name = aws_db_proxy.this[0].name

  connection_pool_config {
    max_connections_percent      = 80
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }

  lifecycle {
    replace_triggered_by = [aws_db_proxy.this[0].id]
  }
}

resource "aws_db_proxy_target" "this" {
  count = var.enable_rds_proxy ? 1 : 0

  db_proxy_name          = aws_db_proxy.this[0].name
  target_group_name      = aws_db_proxy_default_target_group.this[0].name
  db_instance_identifier = aws_db_instance.this.identifier
}

# -----------------------------------------------------------------------------
# ElastiCache Redis
# -----------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-redis"
  subnet_ids = var.data_subnet_ids

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-redis"
  })
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.name_prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-redis7"
  })
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "TicketRush Redis primary/replica"

  engine         = "redis"
  engine_version = var.redis_engine_version
  node_type      = var.redis_node_type

  num_cache_clusters         = var.redis_num_cache_clusters
  automatic_failover_enabled = var.redis_multi_az
  multi_az_enabled           = var.redis_multi_az

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis.result
  auth_token_update_strategy = "ROTATE"

  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.redis_security_group_id]
  parameter_group_name = aws_elasticache_parameter_group.this.name

  maintenance_window         = "sun:05:00-sun:06:00"
  snapshot_window            = "02:00-03:00"
  snapshot_retention_limit   = 5
  apply_immediately          = true
  auto_minor_version_upgrade = true

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-redis"
  })
}

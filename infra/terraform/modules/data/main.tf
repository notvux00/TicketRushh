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

resource "random_password" "ticket_signing" {
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

resource "aws_secretsmanager_secret" "ticket_signing" {
  name                    = "${var.name_prefix}/ticket-signing"
  description             = "TicketRush ticket QR signing secret"
  recovery_window_in_days = var.secret_recovery_window_days

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "ticket_signing" {
  secret_id     = aws_secretsmanager_secret.ticket_signing.id
  secret_string = random_password.ticket_signing.result
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

output "db_instance_id" {
  description = "RDS instance identifier."
  value       = aws_db_instance.this.identifier
}

output "db_arn" {
  description = "RDS instance ARN."
  value       = aws_db_instance.this.arn
}

output "db_address" {
  description = "Database endpoint chosen for the application (RDS Proxy when enabled)."
  value       = var.enable_rds_proxy ? aws_db_proxy.this[0].endpoint : aws_db_instance.this.address
}

output "db_port" {
  description = "Database port."
  value       = 5432
}

output "db_name" {
  description = "Application database name."
  value       = var.db_name
}

output "db_secret_name" {
  description = "Secrets Manager secret name for database credentials."
  value       = aws_secretsmanager_secret.db.name
}

output "db_secret_arn" {
  description = "Secrets Manager secret ARN for database credentials."
  value       = aws_secretsmanager_secret.db.arn
}

output "redis_replication_group_id" {
  description = "ElastiCache replication group ID."
  value       = aws_elasticache_replication_group.this.replication_group_id
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port."
  value       = 6379
}

output "redis_secret_name" {
  description = "Secrets Manager secret name for the Redis auth token."
  value       = aws_secretsmanager_secret.redis.name
}

output "jwt_secret_name" {
  description = "Secrets Manager secret name for the JWT signing key."
  value       = aws_secretsmanager_secret.jwt.name
}

output "admin_secret_name" {
  description = "Secrets Manager secret name for the initial admin password."
  value       = aws_secretsmanager_secret.admin.name
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint, or null when disabled."
  value       = var.enable_rds_proxy ? aws_db_proxy.this[0].endpoint : null
}

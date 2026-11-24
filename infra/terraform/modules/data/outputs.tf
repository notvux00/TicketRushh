# Resource-backed outputs are placeholders in this local scaffold.

output "db_instance_id" {
  description = "RDS instance identifier."
  value       = null
}

output "db_arn" {
  description = "RDS instance ARN."
  value       = null
}

output "db_address" {
  description = "Database endpoint chosen for the application (RDS Proxy when enabled)."
  value       = null
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
  value       = null
}

output "db_secret_arn" {
  description = "Secrets Manager secret ARN for database credentials."
  value       = null
}

output "redis_replication_group_id" {
  description = "ElastiCache replication group ID."
  value       = null
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint."
  value       = null
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint."
  value       = null
}

output "redis_port" {
  description = "Redis port."
  value       = 6379
}

output "redis_secret_name" {
  description = "Secrets Manager secret name for the Redis auth token."
  value       = null
}

output "jwt_secret_name" {
  description = "Secrets Manager secret name for the JWT signing key."
  value       = null
}

output "ticket_signing_secret_name" {
  description = "Secrets Manager secret name for the ticket QR signing key."
  value       = null
}

output "admin_secret_name" {
  description = "Secrets Manager secret name for the initial admin password."
  value       = null
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint, or null when disabled."
  value       = null
}

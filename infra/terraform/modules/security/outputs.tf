# Outputs are placeholders until their resources are defined.

output "alb_security_group_id" {
  description = "Security group attached to the ALB."
  value       = aws_security_group.alb.id
}

output "app_security_group_id" {
  description = "Security group attached to application instances."
  value       = aws_security_group.app.id
}

output "db_security_group_id" {
  description = "Security group attached to RDS."
  value       = null
}

output "rds_proxy_security_group_id" {
  description = "Security group attached to RDS Proxy."
  value       = null
}

output "redis_security_group_id" {
  description = "Security group attached to ElastiCache."
  value       = null
}

output "instance_profile_name" {
  description = "EC2 instance profile for the backend."
  value       = aws_iam_instance_profile.app.name
}

output "instance_role_arn" {
  description = "EC2 instance role ARN."
  value       = aws_iam_role.app.arn
}

output "lambda_security_group_id" {
  description = "Security group for the Lambda maintenance worker."
  value       = null
}

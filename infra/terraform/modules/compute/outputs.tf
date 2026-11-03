output "ecr_repository_name" {
  description = "ECR repository name."
  value       = aws_ecr_repository.backend.name
}

output "ecr_repository_url" {
  description = "ECR repository URL used by CI and user data."
  value       = aws_ecr_repository.backend.repository_url
}

output "image_tag_parameter_name" {
  description = "SSM parameter that holds the deployed image tag."
  value       = aws_ssm_parameter.image_tag.name
}

output "log_group_name" {
  description = "CloudWatch Logs group for the backend container."
  value       = aws_cloudwatch_log_group.backend.name
}

output "launch_template_id" {
  description = "Launch template ID."
  value       = aws_launch_template.app.id
}

output "autoscaling_group_name" {
  description = "ASG name used by CloudWatch alarms and instance refresh."
  value       = aws_autoscaling_group.app.name
}

output "autoscaling_group_arn" {
  description = "ASG ARN."
  value       = aws_autoscaling_group.app.arn
}

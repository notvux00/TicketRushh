# Resource-backed outputs are placeholders in this local scaffold.

output "sns_topic_arn" {
  description = "SNS topic that receives alarm notifications."
  value       = null
}

output "dashboard_name" {
  description = "CloudWatch dashboard name, or null when disabled."
  value       = null
}

output "alarm_names" {
  description = "Created CloudWatch alarm names."
  value       = null
}

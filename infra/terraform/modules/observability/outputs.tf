output "sns_topic_arn" {
  description = "SNS topic that receives alarm notifications."
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_name" {
  description = "CloudWatch dashboard name, or null when disabled."
  value       = var.enable_dashboard ? one(aws_cloudwatch_dashboard.this[*].dashboard_name) : null
}

output "alarm_names" {
  description = "Created CloudWatch alarm names."
  value = [
    aws_cloudwatch_metric_alarm.alb_5xx.alarm_name,
    aws_cloudwatch_metric_alarm.target_response_time.alarm_name,
    aws_cloudwatch_metric_alarm.unhealthy_hosts.alarm_name,
    aws_cloudwatch_metric_alarm.asg_cpu.alarm_name,
    aws_cloudwatch_metric_alarm.rds_cpu.alarm_name,
    aws_cloudwatch_metric_alarm.redis_cpu.alarm_name,
  ]
}

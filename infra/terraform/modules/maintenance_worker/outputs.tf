output "function_name" {
  description = "Lambda function name."
  value       = aws_lambda_function.maintenance.function_name
}

output "function_arn" {
  description = "Lambda function ARN."
  value       = aws_lambda_function.maintenance.arn
}

output "log_group_name" {
  description = "CloudWatch log group for the maintenance worker."
  value       = aws_cloudwatch_log_group.lambda.name
}

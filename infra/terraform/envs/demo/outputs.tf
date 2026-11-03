output "application_url" {
  description = "Public HTTPS URL."
  value       = "https://${module.edge.app_fqdn}"
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = module.edge.cloudfront_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidations."
  value       = module.edge.cloudfront_distribution_id
}

output "frontend_bucket_name" {
  description = "S3 bucket that receives the React build."
  value       = module.edge.frontend_bucket_name
}

output "route53_name_servers" {
  description = "Create NS records for the subdomain at Cloudflare with these values."
  value       = module.edge.route53_name_servers
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID."
  value       = module.edge.route53_zone_id
}

output "alb_dns_name" {
  description = "Origin ALB DNS name."
  value       = module.edge.alb_dns_name
}

output "ecr_repository_url" {
  description = "Push backend images here."
  value       = module.compute.ecr_repository_url
}

output "image_tag_parameter_name" {
  description = "SSM parameter to update with the deployed image tag."
  value       = module.compute.image_tag_parameter_name
}

output "log_group_name" {
  description = "Backend CloudWatch log group."
  value       = module.compute.log_group_name
}

output "database_endpoint" {
  description = "PostgreSQL endpoint used by the application."
  value       = module.data.db_address
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint."
  value       = module.data.redis_primary_endpoint
}

output "sns_alerts_topic_arn" {
  description = "SNS topic for CloudWatch alarms."
  value       = module.observability.sns_topic_arn
}

output "admin_password_secret_name" {
  description = "Secrets Manager secret holding the initial admin password."
  value       = module.data.admin_secret_name
}

output "origin_verify_parameter_name" {
  description = "SSM parameter holding the CloudFront-to-ALB shared secret."
  value       = module.edge.origin_verify_parameter_name
}

output "autoscaling_group_name" {
  description = "ASG name."
  value       = module.compute.autoscaling_group_name
}

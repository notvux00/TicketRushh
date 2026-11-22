# Role 1 outputs are placeholders in this local scaffold.

output "app_fqdn" {
  description = "Public application hostname."
  value       = null
}

output "origin_fqdn" {
  description = "ALB origin hostname."
  value       = null
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID for the delegated subdomain."
  value       = null
}

output "route53_name_servers" {
  description = "Route 53 name servers to add as NS records for the subdomain at Cloudflare."
  value       = null
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = null
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = null
}

output "alb_arn" {
  description = "ALB ARN."
  value       = null
}

output "alb_dns_name" {
  description = "ALB DNS name."
  value       = null
}

output "alb_zone_id" {
  description = "ALB hosted zone ID."
  value       = null
}

output "target_group_arn" {
  description = "Target group ARN used by the ASG."
  value       = null
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix used in CloudWatch dimensions."
  value       = null
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix used in CloudWatch dimensions."
  value       = null
}

output "frontend_bucket_name" {
  description = "Private S3 bucket for the React build."
  value       = null
}

output "frontend_bucket_arn" {
  description = "ARN of the frontend bucket."
  value       = null
}

output "media_bucket_name" {
  description = "Private S3 bucket for media uploads."
  value       = null
}

output "media_bucket_arn" {
  description = "ARN of the media bucket."
  value       = null
}

output "origin_verify_parameter_name" {
  description = "SSM parameter holding the CloudFront-to-ALB shared secret."
  value       = null
}

output "waf_web_acl_arn" {
  description = "CloudFront WAF WebACL ARN, or null when WAF is disabled."
  value       = var.enable_waf ? one(aws_wafv2_web_acl.this[*].arn) : null
}

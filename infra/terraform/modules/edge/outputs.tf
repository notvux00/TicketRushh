output "app_fqdn" {
  description = "Public application hostname."
  value       = local.app_fqdn
}

output "origin_fqdn" {
  description = "ALB origin hostname."
  value       = local.origin_fqdn
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID for the delegated subdomain."
  value       = aws_route53_zone.this.zone_id
}

output "route53_name_servers" {
  description = "Route 53 name servers to add as NS records for the subdomain at Cloudflare."
  value       = aws_route53_zone.this.name_servers
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "alb_arn" {
  description = "ALB ARN."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "ALB DNS name."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID."
  value       = aws_lb.this.zone_id
}

output "target_group_arn" {
  description = "Target group ARN used by the ASG."
  value       = aws_lb_target_group.app.arn
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix used in CloudWatch dimensions."
  value       = aws_lb.this.arn_suffix
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix used in CloudWatch dimensions."
  value       = aws_lb_target_group.app.arn_suffix
}

output "frontend_bucket_name" {
  description = "Private S3 bucket for the React build."
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_arn" {
  description = "ARN of the frontend bucket."
  value       = aws_s3_bucket.frontend.arn
}

output "media_bucket_name" {
  description = "Private S3 bucket for media uploads."
  value       = aws_s3_bucket.media.bucket
}

output "media_bucket_arn" {
  description = "ARN of the media bucket."
  value       = aws_s3_bucket.media.arn
}

output "origin_verify_parameter_name" {
  description = "SSM parameter holding the CloudFront-to-ALB shared secret."
  value       = aws_ssm_parameter.origin_verify.name
}

output "waf_web_acl_arn" {
  description = "CloudFront WAF WebACL ARN, or null when WAF is disabled."
  value       = var.enable_waf ? one(aws_wafv2_web_acl.this[*].arn) : null
}

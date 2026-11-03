variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "environment" {
  description = "Environment name used in SSM paths and descriptions."
  type        = string
}

variable "config_prefix" {
  description = "SSM parameter path prefix, for example /ticketrush/demo."
  type        = string
}

variable "domain_name" {
  description = "Parent domain, for example sudothanh.me."
  type        = string
}

variable "subdomain" {
  description = "Subdomain delegated to Route 53, for example ticketrush."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "alb_subnet_ids" {
  description = "Subnets for the ALB. Public subnets in demo, private app subnets in production."
  type        = list(string)
}

variable "alb_scheme" {
  description = "internet-facing (demo) or internal (production VPC origin)."
  type        = string
  default     = "internet-facing"

  validation {
    condition     = contains(["internet-facing", "internal"], var.alb_scheme)
    error_message = "alb_scheme must be internet-facing or internal."
  }
}

variable "alb_security_group_id" {
  description = "Security group for the ALB."
  type        = string
}

variable "enable_vpc_origin" {
  description = "Use a private ALB behind a CloudFront VPC origin (production)."
  type        = bool
  default     = false
}

variable "enable_waf" {
  description = "Associate a CloudFront-scoped WAF WebACL (production)."
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  description = "Requests per 5 minutes per IP for the WAF rate-based rule."
  type        = number
  default     = 2000
}

variable "health_check_path" {
  description = "ALB target group health check path."
  type        = string
  default     = "/actuator/health/readiness"
}

variable "origin_verify_header_name" {
  description = "Custom header that CloudFront sends to the ALB."
  type        = string
  default     = "X-Origin-Verify"
}

variable "frontend_bucket_prefix" {
  description = "Prefix for the private S3 bucket that stores the React build."
  type        = string
}

variable "media_bucket_prefix" {
  description = "Prefix for the private S3 bucket that stores uploaded media."
  type        = string
}

variable "media_cors_origins" {
  description = "Browser origins allowed to PUT presigned uploads directly to the media bucket."
  type        = list(string)
}

variable "cloudfront_price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_200"
}

variable "force_destroy_buckets" {
  description = "Allow Terraform to delete non-empty S3 buckets (demo must be true)."
  type        = bool
  default     = true
}

variable "force_destroy_dns_zone" {
  description = "Allow Terraform to delete the Route 53 zone and all records (demo true, prod false)."
  type        = bool
  default     = true
}

variable "alb_deletion_protection" {
  description = "Enable ALB deletion protection."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

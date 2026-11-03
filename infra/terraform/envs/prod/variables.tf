variable "aws_region" {
  description = "Primary AWS region."
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project slug used in resource names."
  type        = string
  default     = "ticketrush"
}

variable "environment" {
  description = "Environment slug used in resource names."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Parent domain hosted outside Route 53 (Cloudflare)."
  type        = string
  default     = "sudothanh.me"
}

variable "subdomain" {
  description = "Subdomain delegated to Route 53 for this environment. Keep it different from demo."
  type        = string
  default     = "ticketrush-prod"
}

variable "admin_email" {
  description = "Initial TicketRush admin email address."
  type        = string
}

variable "alarm_email" {
  description = "Email address subscribed to CloudWatch alarm notifications."
  type        = string
}

variable "image_tag" {
  description = "Initial backend image tag. CI updates the SSM parameter after this."
  type        = string
  default     = "latest"
}

variable "instance_type" {
  description = "EC2 instance type for production backend instances."
  type        = string
  default     = "t3.medium"
}

variable "asg_min_size" {
  description = "ASG minimum size."
  type        = number
  default     = 3
}

variable "asg_max_size" {
  description = "ASG maximum size."
  type        = number
  default     = 10
}

variable "asg_desired_capacity" {
  description = "ASG desired capacity."
  type        = number
  default     = 3
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.small"
}

variable "db_backup_retention_period" {
  description = "Automated RDS backup retention in days."
  type        = number
  default     = 14
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.small"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_200"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention."
  type        = number
  default     = 30
}

variable "enable_dashboard" {
  description = "Create the CloudWatch overview dashboard."
  type        = bool
  default     = true
}

variable "nat_gateway_count" {
  description = "NAT gateways. Production uses one per AZ."
  type        = number
  default     = 2

  validation {
    condition     = var.nat_gateway_count == 2
    error_message = "Production expects two NAT gateways (one per AZ)."
  }
}

variable "enable_interface_endpoints" {
  description = "Create interface endpoints for ECR, Logs, Secrets Manager and SSM. The S3 gateway endpoint is always created."
  type        = bool
  default     = true
}

variable "enable_vpc_origin" {
  description = "Put the ALB in private subnets and connect CloudFront through a VPC origin."
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Associate a CloudFront-scoped WAF WebACL."
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "WAF rate limit per IP per 5 minutes."
  type        = number
  default     = 2000
}

# -----------------------------------------------------------------------------
# Optional platform features. These are placeholders and default to false.
# Enabling them requires additional Terraform resources that are intentionally
# not part of this scaffold.
# -----------------------------------------------------------------------------

variable "enable_shield_advanced" {
  description = "Placeholder for AWS Shield Advanced (subscription required)."
  type        = bool
  default     = false
}

variable "enable_aws_backup" {
  description = "Placeholder for AWS Backup plans and vaults."
  type        = bool
  default     = false
}

variable "enable_cloudtrail" {
  description = "Placeholder for an organisation or account CloudTrail trail."
  type        = bool
  default     = false
}

variable "enable_guardduty" {
  description = "Placeholder for GuardDuty detector configuration."
  type        = bool
  default     = false
}

variable "enable_config" {
  description = "Placeholder for AWS Config recorders and rules."
  type        = bool
  default     = false
}

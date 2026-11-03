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
  default     = "demo"
}

variable "domain_name" {
  description = "Parent domain hosted outside Route 53 (Cloudflare)."
  type        = string
  default     = "sudothanh.me"
}

variable "subdomain" {
  description = "Subdomain delegated to Route 53 for this environment."
  type        = string
  default     = "ticketrush"
}

variable "admin_email" {
  description = "Initial TicketRush admin email address."
  type        = string
}

variable "admin_password" {
  description = "Initial demo admin password. Prefer a strong value; leave empty to generate one."
  type        = string
  default     = "admin123"
  sensitive   = true
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
  description = "EC2 instance type for backend instances."
  type        = string
  default     = "t3.small"
}

variable "asg_min_size" {
  description = "ASG minimum size."
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "ASG maximum size."
  type        = number
  default     = 4
}

variable "asg_desired_capacity" {
  description = "ASG desired capacity."
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_200"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention."
  type        = number
  default     = 14
}

variable "enable_dashboard" {
  description = "Create the CloudWatch overview dashboard."
  type        = bool
  default     = true
}

variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "config_prefix" {
  description = "SSM parameter path prefix, for example /ticketrush/demo."
  type        = string
}

variable "app_subnet_ids" {
  description = "Private application subnet IDs for the ASG."
  type        = list(string)
}

variable "app_security_group_id" {
  description = "Security group for backend instances."
  type        = string
}

variable "instance_profile_name" {
  description = "IAM instance profile name."
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group ARN."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.small"
}

variable "min_size" {
  description = "ASG minimum size."
  type        = number
  default     = 2
}

variable "max_size" {
  description = "ASG maximum size."
  type        = number
  default     = 4
}

variable "desired_capacity" {
  description = "ASG desired capacity."
  type        = number
  default     = 2
}

variable "root_volume_size" {
  description = "Root EBS volume size in GiB."
  type        = number
  default     = 30
}

variable "image_tag_default" {
  description = "Initial image tag stored in SSM. CI updates this parameter after pushing to ECR."
  type        = string
  default     = "latest"
}

variable "db_url" {
  description = "JDBC URL for PostgreSQL (RDS Proxy endpoint in production)."
  type        = string
}

variable "db_secret_name" {
  description = "Secrets Manager secret name for database credentials."
  type        = string
}

variable "redis_host" {
  description = "Redis primary endpoint."
  type        = string
}

variable "redis_port" {
  description = "Redis port."
  type        = number
  default     = 6379
}

variable "redis_secret_name" {
  description = "Secrets Manager secret name for the Redis auth token."
  type        = string
}

variable "jwt_secret_name" {
  description = "Secrets Manager secret name for the JWT signing key."
  type        = string
}

variable "admin_secret_name" {
  description = "Secrets Manager secret name for the initial admin password."
  type        = string
}

variable "admin_email" {
  description = "Initial admin email address."
  type        = string
}

variable "app_fqdn" {
  description = "Public application hostname, used for CORS and media URLs."
  type        = string
}

variable "media_bucket_name" {
  description = "Private S3 media bucket name."
  type        = string
}

variable "media_region" {
  description = "Region of the media bucket."
  type        = string
}

variable "cors_allowed_origins" {
  description = "Browser origins allowed by Spring CORS."
  type        = list(string)
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days."
  type        = number
  default     = 14
}

variable "ecr_force_delete" {
  description = "Allow deletion of the ECR repository even when it contains images (demo must be true)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

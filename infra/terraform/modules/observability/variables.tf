variable "name_prefix" {
  description = "Prefix used for alarm and dashboard names."
  type        = string
}

variable "alarm_email" {
  description = "Email subscribed to the SNS alert topic. Leave empty to skip the subscription."
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch dimensions."
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target group ARN suffix for CloudWatch dimensions."
  type        = string
}

variable "autoscaling_group_name" {
  description = "ASG name for EC2 CPU alarms."
  type        = string
}

variable "db_instance_id" {
  description = "RDS instance identifier."
  type        = string
}

variable "redis_replication_group_id" {
  description = "ElastiCache replication group ID."
  type        = string
}

variable "alb_5xx_threshold" {
  description = "ALB 5xx count over one 5-minute period that triggers an alarm."
  type        = number
  default     = 20
}

variable "target_response_time_threshold" {
  description = "Average target response time in seconds that triggers an alarm."
  type        = number
  default     = 2
}

variable "asg_cpu_threshold" {
  description = "ASG average CPU percentage threshold."
  type        = number
  default     = 70
}

variable "rds_cpu_threshold" {
  description = "RDS average CPU percentage threshold."
  type        = number
  default     = 80
}

variable "redis_cpu_threshold" {
  description = "Redis engine CPU percentage threshold."
  type        = number
  default     = 75
}

variable "enable_dashboard" {
  description = "Create the CloudWatch dashboard."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

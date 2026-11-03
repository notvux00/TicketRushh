variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "data_subnet_ids" {
  description = "Private data subnet IDs for RDS and ElastiCache."
  type        = list(string)
}

variable "db_security_group_id" {
  description = "Security group for the RDS instance."
  type        = string
}

variable "redis_security_group_id" {
  description = "Security group for ElastiCache."
  type        = string
}

variable "rds_proxy_security_group_id" {
  description = "Security group for RDS Proxy."
  type        = string
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "ticketrush"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "ticketrush"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ."
  type        = bool
  default     = true
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum RDS storage for autoscaling in GiB. Set to 0 to disable."
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Automated backup retention in days."
  type        = number
  default     = 7
}

variable "db_skip_final_snapshot" {
  description = "Skip the final RDS snapshot (demo must be true)."
  type        = bool
  default     = true
}

variable "db_deletion_protection" {
  description = "Enable RDS deletion protection (demo must be false)."
  type        = bool
  default     = false
}

variable "db_apply_immediately" {
  description = "Apply RDS modifications immediately."
  type        = bool
  default     = true
}

variable "enable_rds_proxy" {
  description = "Create an RDS Proxy between the application and PostgreSQL."
  type        = bool
  default     = false
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters (primary + replicas). Must be at least 2 for Multi-AZ."
  type        = number
  default     = 2
}

variable "redis_multi_az" {
  description = "Enable ElastiCache Multi-AZ with automatic failover."
  type        = bool
  default     = true
}

variable "admin_password" {
  description = "Optional demo admin password. Empty means generate a random one."
  type        = string
  default     = ""
  sensitive   = true
}

variable "secret_recovery_window_days" {
  description = "Secrets Manager recovery window. Use 0 for instant deletion in demo."
  type        = number
  default     = 0
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

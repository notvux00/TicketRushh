variable "name_prefix" {
  description = "Resource name prefix (e.g. ticketrush-demo)."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for Lambda VPC placement."
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID for the Lambda function."
  type        = string
}

variable "db_secret_name" {
  description = "Secrets Manager secret name for DB credentials."
  type        = string
}

variable "db_secret_arn" {
  description = "Secrets Manager secret ARN for DB credentials."
  type        = string
}

variable "db_host" {
  description = "RDS endpoint hostname."
  type        = string
}

variable "db_port" {
  description = "RDS port."
  type        = number
  default     = 5432
}

variable "psycopg2_layer_arn" {
  description = "ARN of a Lambda layer providing psycopg2-binary. Leave empty to bundle in zip."
  type        = string
  default     = ""
}

variable "reserved_concurrency" {
  description = "Reserved concurrent executions for the worker. Use -1 on accounts whose unreserved concurrency is already at the 10-execution minimum."
  type        = number
  default     = 1
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Common resource tags."
  type        = map(string)
  default     = {}
}

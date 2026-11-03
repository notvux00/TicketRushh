variable "name_prefix" {
  description = "Prefix used for resource names and Name tags."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use. Must match the subnet CIDR list lengths."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "app_subnet_cidrs" {
  description = "CIDR blocks for private application subnets (one per AZ)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "data_subnet_cidrs" {
  description = "CIDR blocks for private data subnets (one per AZ)."
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "nat_gateway_count" {
  description = "Number of NAT gateways. Demo uses 1 (AZ A), production uses 2."
  type        = number
  default     = 1

  validation {
    condition     = var.nat_gateway_count >= 0 && var.nat_gateway_count <= 2
    error_message = "nat_gateway_count must be 0, 1 or 2."
  }
}

variable "enable_interface_endpoints" {
  description = "Create interface VPC endpoints for ECR, CloudWatch Logs, Secrets Manager and SSM. The S3 gateway endpoint is always created."
  type        = bool
  default     = false
}

variable "interface_endpoint_services" {
  description = "Service names (without the com.amazonaws.<region>. prefix) for optional interface endpoints."
  type        = list(string)
  default = [
    "ecr.api",
    "ecr.dkr",
    "logs",
    "secretsmanager",
    "ssm",
    "ssmmessages",
    "ec2messages",
  ]
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "config_prefix" {
  description = "SSM parameter path prefix, for example /ticketrush/demo."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
}

variable "media_bucket_prefix" {
  description = "S3 bucket name prefix used by the media bucket (for IAM scoping)."
  type        = string
}

variable "enable_vpc_origin" {
  description = "Allow the private ALB to receive traffic from CloudFront VPC origin ENIs in the VPC."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

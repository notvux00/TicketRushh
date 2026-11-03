variable "aws_region" {
  description = "AWS region for the Terraform state bucket and lock table."
  type        = string
  default     = "ap-southeast-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform remote state."
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table used for Terraform state locking."
  type        = string
  default     = "ticketrush-terraform-locks"
}

variable "github_org" {
  description = "GitHub organisation or user that owns the repository."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without the owner prefix)."
  type        = string
}

variable "github_branch" {
  description = "Branch allowed to assume the deploy role."
  type        = string
  default     = "main"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set to false if the account already has one for token.actions.githubusercontent.com."
  type        = bool
  default     = true
}

variable "existing_github_oidc_provider_arn" {
  description = "ARN of an existing GitHub OIDC provider. Required when create_github_oidc_provider is false."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to created resources."
  type        = map(string)
  default = {
    Project   = "TicketRush"
    ManagedBy = "Terraform"
  }
}

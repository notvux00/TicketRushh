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
  description = "Branch allowed for jobs without an environment. Environment jobs use github_environments and GitHub Environment branch protection."
  type        = string
  default     = "main"
}

variable "github_environments" {
  description = "Exact GitHub Environment names allowed to deploy. Configure their branch rules and required reviewers in GitHub."
  type        = set(string)
  default     = ["demo", "prod"]

  validation {
    condition     = alltrue([for name in var.github_environments : length(trimspace(name)) > 0 && !strcontains(name, "*") && !strcontains(name, "?")])
    error_message = "Environment names must be nonempty exact names, without wildcards."
  }
}

variable "github_subject_repository" {
  description = "Optional exact OIDC repository segment (without repo:), e.g. OWNER@123/REPO@456 for immutable subjects. Empty uses github_org/github_repo."
  type        = string
  default     = ""

  validation {
    condition     = var.github_subject_repository == "" || can(regex("^[A-Za-z0-9_.-]+(@[0-9]+)?/[A-Za-z0-9_.-]+(@[0-9]+)?$", var.github_subject_repository))
    error_message = "Use an exact OWNER/REPO or OWNER@ID/REPO@ID repository segment."
  }
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

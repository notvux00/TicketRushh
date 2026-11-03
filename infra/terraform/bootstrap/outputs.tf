output "state_bucket" {
  description = "S3 bucket name for the Terraform backend."
  value       = aws_s3_bucket.state.bucket
}

output "lock_table" {
  description = "DynamoDB table name for Terraform state locking."
  value       = aws_dynamodb_table.lock.name
}

output "github_deploy_role_arn" {
  description = "IAM role ARN for GitHub Actions (OIDC, no long-lived keys)."
  value       = aws_iam_role.deploy.arn
}

output "github_oidc_provider_arn" {
  description = "GitHub OIDC provider ARN used by the deploy role."
  value       = local.oidc_provider_arn
}

output "aws_account_id" {
  description = "Account that owns the bootstrap resources."
  value       = data.aws_caller_identity.current.account_id
}

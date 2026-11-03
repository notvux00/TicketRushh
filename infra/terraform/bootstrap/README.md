# Bootstrap (run once, manually)

This stack creates the resources Terraform needs before an environment can use
an S3 backend:

- S3 bucket for remote state (versioned, encrypted, public access blocked)
- DynamoDB table for state locking
- GitHub Actions OIDC provider and deploy role

It is **not** part of `envs/demo` or `envs/prod`. Run it once with local state,
then copy the outputs into the environment backend configuration.

## Run

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# Edit the bucket name and GitHub owner/repo.

aws sts get-caller-identity   # confirm the intended account
terraform init
terraform apply
```

Record the outputs:

```bash
terraform output state_bucket
terraform output lock_table
terraform output github_deploy_role_arn
```

The GitHub Workflow assumes the deploy role through OIDC:

```
role-to-assume: arn:aws:iam::<account-id>:role/ticketrush-github-deploy
```

## If the GitHub OIDC provider already exists

An AWS account can only have one provider for
`token.actions.githubusercontent.com`. Import the existing provider first, or
set `create_github_oidc_provider = false` and
`existing_github_oidc_provider_arn` in `terraform.tfvars`.

```bash
terraform import aws_iam_openid_connect_provider.github \
  arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com
```

## Enable the S3 backend

For each environment:

```bash
cd ../envs/demo
cp ../../backend.tf.example backend.tf
# Fill in bucket, key and dynamodb_table.
terraform init -migrate-state
```

Do the same for `envs/prod` with a different state key.

## Notes

- This stack keeps its own state locally. Protect `terraform.tfstate` in this
  directory, or add a second bootstrapping step later if you need remote state
  for bootstrap itself.
- The deploy role uses `PowerUserAccess` plus `IAMFullAccess` so the student
  stack can create IAM roles and instance profiles. Tighten this policy before
  using it for anything other than a sandbox account.

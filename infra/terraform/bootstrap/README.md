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

The role trusts exact subjects for `github_environments` (default `demo` and
`prod`), plus `github_branch` for jobs without an environment. A job that sets
`environment: demo` uses an environment subject even when it runs on `main`.
Configure allowed deployment branches and required reviewers on each GitHub
Environment: the branch subject does not restrict an environment subject.

For repositories using immutable OIDC subjects, set
`github_subject_repository = "OWNER@OWNER_ID/REPO@REPO_ID"` with the actual numeric
IDs from GitHub. Otherwise leave it empty to use `github_org/github_repo`.
No repository or environment wildcard is needed. Environment colons are encoded
as `%3A`, following GitHub's subject format.

Existing installations need a separate manual bootstrap `terraform plan` and
`terraform apply` with operator credentials to update the role's trust policy;
the environment stacks do not manage this role. Review the policy before apply.
Until that bootstrap update is applied, GitHub Actions can still fail to assume
the role. Local verification uses `terraform init -backend=false` followed by
`terraform test`; it does not update IAM.

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

Both environment stacks already declare an S3 backend. Supply the bootstrap
outputs with init backend-config arguments, following the [deployment guide](../../../docs/AWS_DEPLOY.md).
For an existing local-state environment, use -migrate-state only after verifying
the destination account/key and saving a state backup.

```bash
cd ../envs/demo
terraform init -backend-config="bucket=YOUR-STATE-BUCKET" \
  -backend-config="key=ticketrush/demo/terraform.tfstate" \
  -backend-config="region=ap-southeast-1" \
  -backend-config="dynamodb_table=YOUR-LOCK-TABLE"
```

Do the same for `envs/prod` with a different state key.

## Notes

- This stack keeps its own state locally. Protect `terraform.tfstate` in this
  directory, or add a second bootstrapping step later if you need remote state
  for bootstrap itself.
- The deploy role uses `PowerUserAccess` plus `IAMFullAccess` so the student
  stack can create IAM roles and instance profiles. Tighten this policy before
  using it for anything other than a sandbox account.

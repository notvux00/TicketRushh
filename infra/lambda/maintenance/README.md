# Maintenance worker

Runs every 15 minutes: expires overdue PENDING orders, releases seats LOCKED
for more than 15 minutes, and deactivates expired or exhausted vouchers.
All jobs share one transaction. Errors roll back and propagate to Lambda.
No draft tickets are deleted. Timestamps are compared in UTC, matching the DB configuration.

## Package and deploy

From the repository root:

```powershell
python infra/lambda/maintenance/build.py
terraform -chdir=infra/terraform/envs/demo init `
  -backend-config="bucket=$env:TF_STATE_BUCKET" `
  -backend-config="key=ticketrush/demo/terraform.tfstate" `
  -backend-config="region=$env:TF_STATE_REGION" `
  -backend-config="dynamodb_table=$env:TF_LOCK_TABLE"
terraform -chdir=infra/terraform/envs/demo validate
terraform -chdir=infra/terraform/envs/demo plan
terraform -chdir=infra/terraform/envs/demo apply
```

Rebuild after changing the handler or requirements. Terraform archives
`.build/package`, including psycopg2's native Linux libraries. The build targets
Python 3.12/x86_64, independent of the host OS and Python version, following
[AWS packaging guidance](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html).
Boto3 is provided by the Lambda runtime.

Supply the existing bootstrap backend values and Terraform inputs as described
in `infra/terraform/README.md`. For local validation only, use `init -backend=false`.

Module callers may instead provide `psycopg2_layer_arn` for a compatible
Python 3.12/x86_64 layer in the same region; in that case Terraform packages only
the handler and no build is needed. No third-party layer is used by default.

Lambda runs in private app subnets with NAT access to Secrets Manager, TLS to
PostgreSQL, a dedicated security group, 14-day logs (configurable), and concurrency
limited to one. DB ingress is owned by the existing security module, alongside
the other DB rules. The demo waits for DB/secret and network security resources
before enabling the schedule.

## Tests

Install host dependencies separately from the Linux deployment package:

```powershell
python -m pip install -r infra/lambda/maintenance/requirements.txt boto3
python -m unittest discover -s infra/lambda/maintenance -p "test_worker.py" -v
docker compose up -d postgres
python infra/lambda/maintenance/test_local.py
```

The local smoke command commits maintenance updates to the selected database.
It uses standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` variables,
with defaults matching Docker Compose. The integration tests use temporary tables
to check boundaries, unaffected rows, idempotency and rollback without modifying
application tables:

```powershell
$env:MAINTENANCE_TEST_DSN = "host=localhost dbname=ticketrush user=postgres password=postgres"
python -m unittest discover -s infra/lambda/maintenance -p "test_worker.py" -v
```

Terraform tests use mocked AWS resources and the real archive provider; they
check the bundled ZIP and optional layer without accessing an AWS account:

```powershell
terraform -chdir=infra/terraform/modules/maintenance_worker init
terraform -chdir=infra/terraform/modules/maintenance_worker test
```

After apply, invoke the function named by Terraform's
`maintenance_worker_function_name` output and check its CloudWatch log group:
`/aws/lambda/<function-name>`. Success returns `statusCode: 200` and three row counts.

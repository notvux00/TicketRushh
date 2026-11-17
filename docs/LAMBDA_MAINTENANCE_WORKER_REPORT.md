# Maintenance worker implementation report

Date: 2026-11-17 (Asia/Saigon)

## Delivered

- Python 3.12 worker: expire stale PENDING orders, release seats LOCKED for more
  than 15 minutes, deactivate expired or exhausted vouchers.
- Atomic transaction, row-count logging, rollback and exception propagation,
  connection cleanup, TLS and bounded connection/query/lock/API timeouts.
- Terraform: IAM, private-subnet Lambda, CloudWatch logs, EventBridge 15-minute
  rule, invocation permission, dedicated security group and DB ingress.
- Demo environment wiring, function-name output and archive provider lock.
- Reproducible psycopg2 Linux x86_64/cp312 package build, optional external layer,
  shared local smoke runner and automated tests.

## Adaptations from the specification

1. DB ingress lives in `modules/security`, where this repository owns its other
   DB rules. No additional input or rule was added to `modules/data`.
2. Default deployment bundles psycopg2 and its native libraries. Archiving only
   `maintenance.py` without a configured layer would fail to import psycopg2.
3. Concurrency is limited to one. The demo module waits for data and security
   resources, and the EventBridge target waits for invocation permission.
4. Backend, frontend and migration source files were not modified.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Terraform formatting | PASS | `terraform fmt -check` for changed Terraform directories |
| Demo Terraform validation | PASS | `terraform init -backend=false`, then `terraform validate` |
| Terraform module tests | PASS, 2/2 | Mock AWS with real archive provider; bundled ZIP and external layer |
| Python tests | PASS, 5/5 | Three unit tests plus two tests against PostgreSQL 16 |
| SQL integration | PASS | Strict time boundaries, preserved active rows, exhausted vouchers with NULL end date, idempotency, full transaction rollback |
| Local smoke runner | PASS | Real V1/V4 migrations; one stale order, seat and voucher changed; ticket FK preserved; second run returned zero counts |
| Native package | PASS | Current handler bytes, cp312/x86_64 Linux ELF extension and bundled libpq present |
| Backend | PASS, 10/10 | `backend/mvnw.cmd clean test`; application context loaded with Testcontainers |
| Frontend | PASS | `npm.cmd run build`; existing bundle-size and Browserslist warnings |
| Patch whitespace | PASS | `git diff --check` |

The first backend run picked up an obsolete V5 migration from `target`.
`clean test` removed that stale build resource and all tests passed.
Compose's default PostgreSQL port 5432 was occupied by another local project;
SQL verification used a dedicated disposable PostgreSQL 16 container on a random
loopback port. That test container was stopped and removed after verification.

## Remaining AWS verification

No AWS resources were applied or invoked during this implementation. Terraform
tests mock AWS, so they do not establish live IAM propagation, VPC connectivity,
Secrets Manager access or EventBridge delivery. AWS deployment still requires
the demo account configuration, `terraform plan`/`apply`, a manual Lambda invoke
and CloudWatch log inspection.

Deployment and test commands are in
[`infra/lambda/maintenance/README.md`](../infra/lambda/maintenance/README.md).
Build artifacts, Python caches, virtual environments and downloaded local tools
are ignored by Git. The supplied specification is preserved.

## Review round 1

Date: 2026-11-17 (Asia/Saigon). Scope: current maintenance-worker changes,
integration with backend data semantics, Terraform and the deployment workflow.
The review initially recorded the finding below; its subsequent fix is recorded
in the resolution section.

### R1-01 — P1: deployment workflow does not build the Lambda package

Location: `infra/terraform/modules/maintenance_worker/main.tf:17`.

The default archive source is
`infra/lambda/maintenance/.build/package`. `git check-ignore` confirms this
directory's handler is ignored, and `.github/workflows/terraform.yml:28-47`
checks out the repository and proceeds directly to Terraform init/plan/apply.
No workflow invokes `build.py` or downloads a prebuilt maintenance artifact.
The demo also does not configure an external psycopg2 layer.

Consequently, an enabled demo deployment on a fresh GitHub Actions runner has
no archive source directory and fails when Terraform evaluates `archive_file`.
The local build and mocked Terraform tests from implementation did not exercise
that clean-runner deployment path. Documentation of a manual build does not
provide the missing workflow step.

Fix: set up Python and run
`python "$GITHUB_WORKSPACE/infra/lambda/maintenance/build.py"` before Terraform
plan in the deployment workflow (its default working directory is the Terraform
environment). Gate this to environments that deploy the worker, or supply a
versioned built artifact explicitly. Verify deployment packaging from a fresh
checkout with no `.build` cache.

No additional confirmed correctness defect was identified in this review.
AWS runtime connectivity and delivery remain unverified, as recorded above.

### R1-01 resolution — fixed

`.github/workflows/terraform.yml` now sets up Python 3.12 and builds the
maintenance package immediately after checkout, before AWS configuration and
Terraform plan/apply. Both new steps run only for the demo environment, which
currently declares the worker. The build step explicitly uses
`${{ github.workspace }}` so its script path resolves from the repository root
instead of the job's Terraform environment directory.

Verification: removed the local package directory after checking its resolved
path remained under the maintenance source directory, then ran the exact build
command used in the workflow. It recreated the package successfully. Assertions
confirmed the current handler, cp312/x86_64 Linux ELF extension and libpq,
step ordering, the demo condition and the working-directory override.
`git diff --check` passed. No GitHub Actions run or AWS apply was performed.

## Review round 2

Date: 2026-11-17 (Asia/Saigon).

Result: no additional confirmed defect identified in the reviewed changes.
R1-01 remains resolved: Python setup and packaging run for demo, the build uses
the repository root, and both precede Terraform plan/apply. The prod workflow
selection skips these two steps, consistent with its current module configuration.

Additional verification performed in this round:

- Ran the built package in the official `public.ecr.aws/lambda/python:3.12`
  Linux amd64 container. Both `maintenance` and native `psycopg2` imported
  successfully; psycopg2 reported version 2.9.10. Runtime image digest:
  `sha256:ca6bfddec7726813ba7251ac1a14c8aefbcc76b18343267c3b5f339c8db2c758`.
- Demo `terraform validate`: passed.
- Python unit tests: 3 passed. The 2 opt-in PostgreSQL tests were skipped in
  this round because no test DSN was supplied; their prior passing integration
  results are recorded above.
- Workflow assertions: build ordering, Python 3.12, both demo guards and the
  explicit repository-root working directory passed.
- `git diff --check`: passed.

This round changed only this report. GitHub Actions execution, live AWS IAM/VPC
connectivity, EventBridge delivery and a deployed Lambda invocation remain
unverified. Importing successfully in the Lambda container does not establish
those live deployment properties.

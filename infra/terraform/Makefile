SHELL := /bin/bash

DEMO_DIR    := envs/demo
PROD_DIR    := envs/prod
BOOT_DIR    := bootstrap

.PHONY: fmt fmt-check init-demo validate-demo init-prod validate-prod \
	init-bootstrap validate-bootstrap check plan-demo apply-demo destroy-demo \
	plan-prod apply-prod destroy-prod clean

fmt:
	terraform fmt -recursive .

fmt-check:
	@terraform fmt -check -recursive .

init-demo:
	cd $(DEMO_DIR) && terraform init -backend=false

validate-demo:
	cd $(DEMO_DIR) && terraform validate

init-prod:
	cd $(PROD_DIR) && terraform init -backend=false

validate-prod:
	cd $(PROD_DIR) && terraform validate

init-bootstrap:
	cd $(BOOT_DIR) && terraform init -backend=false

validate-bootstrap:
	cd $(BOOT_DIR) && terraform validate

check: fmt-check validate-demo validate-prod validate-bootstrap

# The targets below require valid AWS credentials and (for state) a configured
# backend.tf. They are intentionally explicit: nothing here is run by `check`.
plan-demo:
	cd $(DEMO_DIR) && terraform plan -out=demo.tfplan

apply-demo:
	cd $(DEMO_DIR) && terraform apply demo.tfplan

destroy-demo:
	cd $(DEMO_DIR) && terraform destroy

plan-prod:
	@echo "WARNING: prod is code-only in this scaffold. Do not apply it in the student account."
	cd $(PROD_DIR) && terraform plan -out=prod.tfplan

apply-prod:
	@echo "WARNING: prod is code-only in this scaffold. Do not apply it in the student account."
	cd $(PROD_DIR) && terraform apply prod.tfplan

destroy-prod:
	@echo "WARNING: prod is code-only in this scaffold. Do not destroy it without a manual safety review."
	cd $(PROD_DIR) && terraform destroy

clean:
	rm -rf $(DEMO_DIR)/.terraform $(PROD_DIR)/.terraform $(BOOT_DIR)/.terraform
	find . -name '*.tfplan' -delete
	find . -name '.terraform.lock.hcl' -delete

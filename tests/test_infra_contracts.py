"""Check contracts spanning workflow environments and bootstrap IAM wiring."""

from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InfrastructureContractTests(unittest.TestCase):
    def test_workflow_environments_are_in_bootstrap_defaults(self):
        variables = (ROOT / "infra/terraform/bootstrap/variables.tf").read_text()
        declaration = re.search(r'variable "github_environments"\s*\{(.*?)validation', variables, re.S).group(1)
        allowed = set(re.findall(r'"([^"]+)"', declaration.split("default", 1)[1]))
        for name in ("deploy-backend.yml", "deploy-frontend.yml", "terraform.yml"):
            source = (ROOT / ".github/workflows" / name).read_text()
            environments = re.findall(r"^    environment: ([a-zA-Z0-9_-]+)\s*$", source, re.M)
            if "environment: ${{ inputs.environment }}" in source:
                options = re.search(r"options: \[([^]]+)\]", source).group(1)
                environments.extend(value.strip() for value in options.split(","))
            self.assertTrue(environments, name)
            self.assertLessEqual(set(environments), allowed, name)

    def test_role_uses_exact_subjects_and_sts_audience(self):
        source = (ROOT / "infra/terraform/bootstrap/main.tf").read_text()
        policy = source.split('data "aws_iam_policy_document" "github_assume_role"', 1)[1].split('resource "aws_iam_role" "deploy"', 1)[0]
        conditions = re.findall(r"condition\s*\{([^}]+)\}", policy, re.S)
        subject = next(value for value in conditions if ":sub" in value)
        audience = next(value for value in conditions if ":aud" in value)
        self.assertRegex(subject, r'test\s*=\s*"StringEquals"')
        self.assertRegex(subject, r'values\s*=\s*local.github_subjects')
        self.assertRegex(audience, r'test\s*=\s*"StringEquals"')
        self.assertIn('["sts.amazonaws.com"]', audience)
        self.assertIn('assume_role_policy = data.aws_iam_policy_document.github_assume_role.json', source)


if __name__ == "__main__":
    unittest.main()

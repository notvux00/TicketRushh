import itertools
from pathlib import Path
import re
import unittest


class FrontendDeploymentTests(unittest.TestCase):
    workflow = (Path(__file__).resolve().parents[1] / ".github/workflows/deploy-frontend.yml").read_text()

    def test_same_environment_is_serialized_and_assets_are_retained(self):
        self.assertRegex(self.workflow, r"(?m)^concurrency:\s*\n  group: ticketrush-deploy-frontend-demo\s*\n  cancel-in-progress: false")
        sync = self.workflow.split("aws s3 sync", 1)[1].split("aws s3 cp", 1)[0]
        self.assertNotIn("--delete", sync)
        self.assertIn('--exclude "index.html"', sync)
        self.assertIn('frontend/dist/index.html "s3://$BUCKET/index.html"', self.workflow)

    def test_every_overlapping_publish_keeps_current_and_cached_index_assets(self):
        releases = {
            name: {"index.html": f'<script src="/assets/{name}.js"></script><link href="/assets/{name}.css">',
                   f"assets/{name}.js": name, f"assets/{name}.css": name}
            for name in ("A", "B")
        }
        sync_command = self.workflow.split("aws s3 sync", 1)[1].split("aws s3 cp", 1)[0]
        delete = "--delete" in sync_command
        checked = 0
        for steps in itertools.permutations(("upload-A", "publish-A", "upload-B", "publish-B")):
            if any(steps.index(f"publish-{n}") < steps.index(f"upload-{n}") for n in releases):
                continue
            bucket, cached = {}, []
            for step in steps:
                operation, name = step.split("-")
                release = releases[name]
                if operation == "upload":
                    if delete:
                        bucket = {k: v for k, v in bucket.items() if k == "index.html" or k in release}
                    bucket.update({k: v for k, v in release.items() if k != "index.html"})
                else:
                    bucket["index.html"] = release["index.html"]
                    cached.append(bucket["index.html"])
                for index in cached:
                    for asset in re.findall(r'(?:src|href)="/([^\"]+)"', index):
                        self.assertIn(asset, bucket, (steps, step, asset))
            checked += 1
        self.assertEqual(6, checked)


if __name__ == "__main__":
    unittest.main()

import json
import unittest
from unittest.mock import Mock, patch

from scripts.deploy_backend import Deployment, aws


class DeploymentTests(unittest.TestCase):
    def runner(self, statuses, active=False, fail_start=False):
        starts = []
        tags = []
        polls = iter(statuses)
        cancellations = []

        def call(service, operation, **options):
            if operation == "get-parameter":
                return {"Parameter": {"Value": tags[-1] if tags else "previous-image"}}
            if operation == "put-parameter":
                tags.append(options["value"])
                return {}
            if operation == "start-instance-refresh":
                starts.append(options)
                if fail_start and len(starts) == 1:
                    raise RuntimeError("Cannot start refresh")
                return {"InstanceRefreshId": "refresh-" + str(len(starts))}
            if operation == "cancel-instance-refresh":
                cancellations.append(options)
                return {}
            if operation == "describe-instance-refreshes":
                if "max_records" in options:
                    return {"InstanceRefreshes": [{"Status": "InProgress"}] if active else []}
                return {"InstanceRefreshes": [{"Status": next(polls)}]}
            raise AssertionError((service, operation, options))

        return Deployment("review-asg", "review-parameter", call=call, interval=0), starts, tags, cancellations

    def test_waits_for_success(self):
        deploy, starts, tags, _ = self.runner(["Pending", "InProgress", "Baking", "Successful"])
        deploy.deploy("new-image")
        self.assertEqual(tags, ["new-image"])
        self.assertEqual(len(starts), 1)
        preferences = json.loads(starts[0]["preferences"])
        self.assertIs(preferences["AutoRollback"], False)
        self.assertIs(preferences["SkipMatching"], False)

    def test_failed_rollout_restores_tag_and_refreshes_old_image(self):
        deploy, starts, tags, _ = self.runner(["Failed", "Failed", "InProgress", "Successful"])
        with self.assertRaisesRegex(RuntimeError, "ended with Failed"):
            deploy.deploy("new-image")
        self.assertEqual(tags, ["new-image", "previous-image"])
        self.assertEqual(len(starts), 2)

    def test_failed_start_restores_tag(self):
        deploy, starts, tags, _ = self.runner(["Successful"], fail_start=True)
        with self.assertRaisesRegex(RuntimeError, "Cannot start refresh"):
            deploy.deploy("new-image")
        self.assertEqual(tags, ["new-image", "previous-image"])
        self.assertEqual(len(starts), 2)

    def test_lost_start_response_waits_for_unknown_refresh_and_recovers(self):
        tag = "previous-image"
        starts, cancellations, waited = [], [], []

        def call(service, operation, **options):
            nonlocal tag
            if operation == "get-parameter":
                return {"Parameter": {"Value": tag}}
            if operation == "put-parameter":
                tag = options["value"]
                return {}
            if operation == "start-instance-refresh":
                starts.append(options)
                if len(starts) == 1:
                    raise TimeoutError("Response lost after AWS accepted the start")
                return {"InstanceRefreshId": "recovery"}
            if operation == "cancel-instance-refresh":
                cancellations.append(options)
                return {}
            if operation == "describe-instance-refreshes":
                if options.get("max_records") == 1:
                    return {"InstanceRefreshes": []}
                if options.get("max_records") == 100:
                    return {"InstanceRefreshes": [{"InstanceRefreshId": "unknown", "Status": "InProgress"}]}
                waited.extend(options["instance_refresh_ids"])
                return {"InstanceRefreshes": [{"Status": "Successful"}]}
            raise AssertionError(operation)

        with self.assertRaisesRegex(TimeoutError, "Response lost"):
            Deployment("asg", "tag", call=call, interval=0).deploy("new-image")
        self.assertEqual(tag, "previous-image")
        self.assertEqual(waited, ["unknown", "recovery"])
        self.assertEqual(cancellations, [])
        self.assertEqual(len(starts), 2)

    def test_ownership_change_prevents_overwriting_another_deployment(self):
        tag, mutations = "previous", []

        def call(service, operation, **options):
            nonlocal tag
            if operation == "get-parameter":
                return {"Parameter": {"Value": tag}}
            if operation == "put-parameter":
                tag = options["value"]
                mutations.append(tag)
                return {}
            if operation == "describe-instance-refreshes":
                return {"InstanceRefreshes": []}
            if operation == "start-instance-refresh":
                tag = "another-deployment"
                raise TimeoutError("Lost start response")
            raise AssertionError(operation)

        with self.assertRaisesRegex(RuntimeError, "ownership changed"):
            Deployment("asg", "tag", call=call).deploy("new-image")
        self.assertEqual(tag, "another-deployment")
        self.assertEqual(mutations, ["new-image"])

    def test_existing_refresh_prevents_mutation(self):
        deploy, starts, tags, _ = self.runner([], active=True)
        with self.assertRaisesRegex(RuntimeError, "already active"):
            deploy.deploy("new-image")
        self.assertEqual(tags, [])
        self.assertEqual(starts, [])

    def test_timeout_cancels_inflight_refresh_before_recovery(self):
        deploy, starts, tags, cancellations = self.runner(["InProgress", "Cancelling", "Cancelled", "Successful"])
        real_wait = deploy.wait
        calls = 0

        def wait(refresh_id, stopping=False):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise TimeoutError("Rollout deadline")
            return real_wait(refresh_id, stopping)

        with patch.object(deploy, "wait", side_effect=wait):
            with self.assertRaisesRegex(TimeoutError, "Rollout deadline"):
                deploy.deploy("new-image")
        self.assertEqual(tags, ["new-image", "previous-image"])
        self.assertEqual(len(cancellations), 1)
        self.assertEqual(len(starts), 2)

    def test_aws_cli_boolean_flags_are_not_string_values(self):
        result = Mock(stdout="{}")
        with patch("scripts.deploy_backend.subprocess.run", return_value=result) as run:
            aws("ssm", "put-parameter", name="tag", value="commit", overwrite=True)
        args = run.call_args.args[0]
        self.assertIn("--overwrite", args)
        self.assertNotIn("True", args)
        self.assertNotIn("--auto-rollback", args)


if __name__ == "__main__":
    unittest.main()

"""Deploy the SSM-selected image, await rollout and restore the previous image on failure.

Auto Scaling auto rollback cannot restore a mutable SSM image tag. This workflow
therefore restores that tag explicitly and refreshes partially replaced instances.
"""

import json
import os
import subprocess
import sys
import time


ACTIVE = {"Pending", "InProgress", "Baking", "Cancelling", "RollbackInProgress"}


def aws(service, operation, **options):
    args = ["aws", service, operation, "--output", "json", "--no-cli-pager"]
    for name, value in options.items():
        if isinstance(value, bool):
            args.append("--" + ("" if value else "no-") + name.replace("_", "-"))
            continue
        args.append("--" + name.replace("_", "-"))
        if isinstance(value, list):
            args.extend(value)
        else:
            args.append(str(value))
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return json.loads(result.stdout) if result.stdout.strip() else {}


class Deployment:
    def __init__(self, asg, parameter, call=aws, timeout=1800, interval=15):
        self.asg, self.parameter, self.call = asg, parameter, call
        self.timeout, self.interval = timeout, interval

    def set_tag(self, tag):
        self.call("ssm", "put-parameter", name=self.parameter, type="String", value=tag, overwrite=True)

    def current_tag(self):
        return self.call("ssm", "get-parameter", name=self.parameter)["Parameter"]["Value"]

    def recover(self, refresh_id, expected_tag):
        if refresh_id is not None:
            state = self.call("autoscaling", "describe-instance-refreshes",
                              auto_scaling_group_name=self.asg, instance_refresh_ids=[refresh_id])
            items = state.get("InstanceRefreshes", [])
            if items and items[0]["Status"] in ACTIVE:
                self.call("autoscaling", "cancel-instance-refresh", auto_scaling_group_name=self.asg)
                self.wait(refresh_id, stopping=True)
        else:
            # A failed CLI response does not prove that AWS rejected the start.
            # Reconcile the ASG, but never cancel an ID we cannot attribute to
            # this deployment. Wait for unknown work to finish before recovery.
            state = self.call("autoscaling", "describe-instance-refreshes",
                              auto_scaling_group_name=self.asg, max_records=100)
            for item in state.get("InstanceRefreshes", []):
                if item["Status"] in ACTIVE:
                    self.wait(item["InstanceRefreshId"], stopping=True)
        if self.current_tag() != expected_tag:
            raise RuntimeError("Deployment ownership changed while waiting for recovery")
        print("Refreshing instances with the restored image tag", file=sys.stderr)
        self.wait(self.start())

    def start(self):
        response = self.call("autoscaling", "start-instance-refresh", auto_scaling_group_name=self.asg,
                             preferences=json.dumps({"MinHealthyPercentage": 50, "InstanceWarmup": 180,
                                                     "AutoRollback": False, "SkipMatching": False}))
        return response["InstanceRefreshId"]

    def wait(self, refresh_id, stopping=False):
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            response = self.call("autoscaling", "describe-instance-refreshes",
                                 auto_scaling_group_name=self.asg, instance_refresh_ids=[refresh_id])
            items = response.get("InstanceRefreshes", [])
            if items:
                status = items[0]["Status"]
                if status not in ACTIVE:
                    if stopping or status == "Successful":
                        return
                    raise RuntimeError(f"Instance refresh {refresh_id} ended with {status}: "
                                       f"{items[0].get('StatusReason', '')}")
            time.sleep(self.interval)
        raise TimeoutError(f"Instance refresh {refresh_id} did not finish within {self.timeout}s")

    def deploy(self, image_tag):
        current = self.call("autoscaling", "describe-instance-refreshes",
                            auto_scaling_group_name=self.asg, max_records=1).get("InstanceRefreshes", [])
        if any(item["Status"] in ACTIVE for item in current):
            raise RuntimeError("An instance refresh is already active; no image tag was changed")
        previous = self.current_tag()
        refresh_id = None
        try:
            self.set_tag(image_tag)
            refresh_id = self.start()
            self.wait(refresh_id)
        except (Exception, KeyboardInterrupt):
            if self.current_tag() != image_tag:
                # Another operator may have taken over while our CLI failed.
                # Do not overwrite that deployment or cancel its refresh.
                raise RuntimeError("Deployment ownership changed; automatic recovery stopped")
            print("Deployment failed; restoring the previous SSM image tag", file=sys.stderr)
            self.set_tag(previous)
            self.recover(refresh_id, previous)
            raise


def main():
    # Fail before any AWS mutation if deployment inputs are missing.
    required = {name: os.environ.get(name, "") for name in ("ASG_NAME", "PARAMETER_NAME", "IMAGE_TAG")}
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ValueError("Missing deployment inputs: " + ", ".join(missing))
    Deployment(required["ASG_NAME"], required["PARAMETER_NAME"]).deploy(required["IMAGE_TAG"])
    print("Backend instance refresh completed successfully")


if __name__ == "__main__":
    main()

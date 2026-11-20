mock_provider "aws" {
  mock_data "aws_region" {
    defaults = { region = "ap-southeast-1" }
  }
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_resource "aws_launch_template" {
    defaults = { id = "lt-0123456789abcdef0" }
  }
}

variables {
  name_prefix                = "ticketrush-contract-test"
  config_prefix              = "/ticketrush/test"
  app_subnet_ids             = ["subnet-0123456789abcdef0"]
  app_security_group_id      = "sg-0123456789abcdef0"
  instance_profile_name      = "contract-test"
  target_group_arn           = "arn:aws:elasticloadbalancing:ap-southeast-1:123456789012:targetgroup/test/1234567890123456"
  db_url                     = "jdbc:postgresql://database.invalid/ticketrush"
  db_secret_name             = "test/db"
  redis_host                 = "redis.invalid"
  redis_secret_name          = "test/redis"
  jwt_secret_name            = "test/jwt"
  ticket_signing_secret_name = "test/ticket-signing"
  admin_secret_name          = "test/admin"
  admin_email                = "admin@test.invalid"
  app_fqdn                   = "test.invalid"
  media_bucket_name          = "contract-test-media"
  media_region               = "ap-southeast-1"
  cors_allowed_origins       = ["https://test.invalid"]
}

run "aws_ecr_selection_contract" {
  command = plan
  assert {
    condition = alltrue([for rule in jsondecode(aws_ecr_lifecycle_policy.backend.policy).rules :
      rule.selection.tagStatus == "tagged" ?
      (try(length(rule.selection.tagPatternList), 0) > 0) != (try(length(rule.selection.tagPrefixList), 0) > 0) :
      !can(rule.selection.tagPatternList) && !can(rule.selection.tagPrefixList)
    ])
    error_message = "Tagged rules require exactly one tag selector; untagged rules cannot contain one."
  }
  assert {
    condition = anytrue([for rule in jsondecode(aws_ecr_lifecycle_policy.backend.policy).rules :
      try(toset(rule.selection.tagPatternList) == toset(["*"]) && rule.selection.countNumber == 15, false)
    ])
    error_message = "Keep the existing retention of 15 tagged images across all tag names."
  }
}

run "fixed_asg_capacity" {
  command = apply

  variables {
    desired_capacity = 3
  }

  assert {
    condition     = aws_autoscaling_group.app.desired_capacity == 3
    error_message = "Terraform must honor the configured capacity when CPU target tracking is disabled."
  }

  assert {
    condition     = length(aws_autoscaling_policy.cpu_target_tracking) == 0
    error_message = "A fixed-capacity group must have no CPU target tracking policy."
  }
}

run "cpu_target_tracking_preserves_running_capacity" {
  command = plan

  variables {
    cpu_target_utilization = 70
  }

  assert {
    condition     = aws_autoscaling_group.app.desired_capacity == 3
    error_message = "Enabling CPU target tracking must preserve the running capacity rather than resetting it to the fixed default."
  }

  assert {
    condition     = aws_autoscaling_group.app.min_size == 2 && aws_autoscaling_group.app.max_size == 4
    error_message = "The ASG must keep its default capacity limits of 2 and 4."
  }

  assert {
    condition = anytrue([for policy in aws_autoscaling_policy.cpu_target_tracking :
      policy.autoscaling_group_name == aws_autoscaling_group.app.name &&
      policy.policy_type == "TargetTrackingScaling" &&
      policy.target_tracking_configuration[0].target_value == 70 &&
      !policy.target_tracking_configuration[0].disable_scale_in &&
      policy.target_tracking_configuration[0].predefined_metric_specification[0].predefined_metric_type == "ASGAverageCPUUtilization"
    ])
    error_message = "The ASG must scale in both directions using an average CPU target of 70 percent."
  }
}

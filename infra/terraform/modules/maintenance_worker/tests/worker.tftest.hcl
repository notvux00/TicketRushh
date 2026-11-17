mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  name_prefix              = "ticketrush-test"
  subnet_ids               = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  lambda_security_group_id = "sg-0123456789abcdef0"
  db_secret_name           = "ticketrush-test/db"
  db_secret_arn            = "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:ticketrush-test/db-abcdef"
  db_host                  = "private-db.example.com"
}

run "bundled_package" {
  command = plan

  assert {
    condition     = aws_lambda_function.maintenance.runtime == "python3.12" && aws_lambda_function.maintenance.handler == "maintenance.handler" && aws_lambda_function.maintenance.timeout == 30 && aws_lambda_function.maintenance.memory_size == 128
    error_message = "The worker must retain the specified runtime, handler and resource limits."
  }

  assert {
    condition     = aws_cloudwatch_event_rule.every_15_min.schedule_expression == "rate(15 minutes)" && aws_lambda_permission.eventbridge.principal == "events.amazonaws.com"
    error_message = "EventBridge must be allowed to invoke the 15-minute worker."
  }

  assert {
    condition     = length(aws_lambda_function.maintenance.layers) == 0 && data.archive_file.lambda.output_size > 1000000
    error_message = "The default ZIP must include the native database driver, without a third-party layer."
  }

  assert {
    condition     = aws_lambda_function.maintenance.reserved_concurrent_executions == 1 && aws_cloudwatch_log_group.lambda.retention_in_days == 14 && aws_lambda_function.maintenance.vpc_config[0].security_group_ids == toset([var.lambda_security_group_id])
    error_message = "The worker must use its dedicated VPC security group, bounded concurrency and retained logs."
  }
}

run "external_layer" {
  command = plan

  variables {
    psycopg2_layer_arn = "arn:aws:lambda:ap-southeast-1:123456789012:layer:psycopg2-p312:1"
  }

  assert {
    condition     = aws_lambda_function.maintenance.layers == tolist([var.psycopg2_layer_arn]) && data.archive_file.lambda.output_size < 100000
    error_message = "Layer mode must package only the handler and attach the supplied layer."
  }
}

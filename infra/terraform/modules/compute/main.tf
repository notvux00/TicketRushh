data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

locals {
  region        = data.aws_region.current.region
  account_id    = data.aws_caller_identity.current.account_id
  ecr_registry  = "${local.account_id}.dkr.ecr.${local.region}.amazonaws.com"
  log_group     = "${var.config_prefix}/backend"
  cors_origins  = join(",", var.cors_allowed_origins)
  ecr_repo_name = "${var.name_prefix}-backend"

  tags = merge(var.tags, {
    Component = "compute"
  })
}

# -----------------------------------------------------------------------------
# Container registry and deployment parameter
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "backend" {
  name                 = local.ecr_repo_name
  image_tag_mutability = "MUTABLE"
  force_delete         = var.ecr_force_delete

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.tags, {
    Name = local.ecr_repo_name
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep the last 15 tagged images"
        selection = {
          tagStatus   = "tagged"
          countType   = "imageCountMoreThan"
          countNumber = 15
        }
        action = {
          type = "expire"
        }
      },
    ]
  })
}

resource "aws_ssm_parameter" "image_tag" {
  name        = "${var.config_prefix}/image-tag"
  description = "Container image tag deployed by EC2 user data"
  type        = "String"
  value       = var.image_tag_default

  tags = local.tags

  lifecycle {
    # CI owns this value after the initial apply.
    ignore_changes = [value]
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = local.log_group
  retention_in_days = var.log_retention_days

  tags = merge(local.tags, {
    Name = local.log_group
  })
}

# -----------------------------------------------------------------------------
# Launch template
# -----------------------------------------------------------------------------

resource "aws_launch_template" "app" {
  name_prefix   = "${var.name_prefix}-"
  image_id      = data.aws_ami.al2023.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = var.instance_profile_name
  }

  vpc_security_group_ids = [var.app_security_group_id]

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tftpl", {
    region                   = local.region
    ecr_registry             = local.ecr_registry
    ecr_repository_url       = aws_ecr_repository.backend.repository_url
    image_tag_parameter_name = aws_ssm_parameter.image_tag.name
    log_group_name           = aws_cloudwatch_log_group.backend.name
    db_url                   = var.db_url
    db_secret_name           = var.db_secret_name
    redis_host               = var.redis_host
    redis_port               = var.redis_port
    redis_secret_name        = var.redis_secret_name
    jwt_secret_name          = var.jwt_secret_name
    admin_secret_name        = var.admin_secret_name
    admin_email              = var.admin_email
    media_bucket_name        = var.media_bucket_name
    media_region             = var.media_region
    app_fqdn                 = var.app_fqdn
    cors_allowed_origins     = local.cors_origins
    media_public_base_url    = "https://${var.app_fqdn}"
    enable_bootstrap_admin   = "true"
    enable_reset_admin       = "false"
  }))

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    instance_metadata_tags      = "enabled"
  }

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"

    tags = merge(local.tags, {
      Name = "${var.name_prefix}-app"
    })
  }

  tag_specifications {
    resource_type = "volume"

    tags = merge(local.tags, {
      Name = "${var.name_prefix}-app-volume"
    })
  }

  update_default_version = true

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-app"
  })
}

# -----------------------------------------------------------------------------
# Auto Scaling group
# -----------------------------------------------------------------------------

resource "aws_autoscaling_group" "app" {
  name = "${var.name_prefix}-asg"

  vpc_zone_identifier = var.app_subnet_ids
  min_size            = var.min_size
  max_size            = var.max_size
  desired_capacity    = var.desired_capacity

  launch_template {
    id      = aws_launch_template.app.id
    version = aws_launch_template.app.latest_version
  }

  target_group_arns         = [var.target_group_arn]
  health_check_type         = "ELB"
  health_check_grace_period = 300
  force_delete              = true
  wait_for_capacity_timeout = "10m"

  instance_refresh {
    strategy = "Rolling"

    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 120
    }
  }

  dynamic "tag" {
    for_each = merge(local.tags, {
      Name = "${var.name_prefix}-app"
    })

    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  depends_on = [aws_cloudwatch_log_group.backend]
}

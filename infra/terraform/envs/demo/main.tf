locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = "TicketRush"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  config_prefix = "/ticketrush/${var.environment}"

  frontend_bucket_prefix = "${local.name_prefix}-frontend-"
  media_bucket_prefix    = "${local.name_prefix}-media-"

  browser_origins = [
    "https://${var.subdomain}.${var.domain_name}",
    "http://localhost:5173",
  ]
}

module "network" {
  source = "../../modules/network"

  name_prefix = local.name_prefix

  vpc_cidr = "10.0.0.0/16"

  public_subnet_cidrs = ["10.0.0.0/24", "10.0.1.0/24"]
  app_subnet_cidrs    = ["10.0.10.0/24", "10.0.11.0/24"]
  data_subnet_cidrs   = ["10.0.20.0/24", "10.0.21.0/24"]

  # Demo: one NAT gateway in AZ A. Both private app route tables use it.
  nat_gateway_count = 1

  # Demo keeps NAT-only egress to stay cheap. Turn this on to remove NAT
  # dependency for ECR, Secrets Manager, SSM and CloudWatch.
  enable_interface_endpoints = false

  tags = local.common_tags
}

module "security" {
  source = "../../modules/security"

  name_prefix         = local.name_prefix
  config_prefix       = local.config_prefix
  vpc_id              = module.network.vpc_id
  vpc_cidr            = module.network.vpc_cidr
  media_bucket_prefix = local.media_bucket_prefix

  enable_vpc_origin = false

  tags = local.common_tags
}

module "data" {
  source = "../../modules/data"

  name_prefix = local.name_prefix

  data_subnet_ids             = module.network.data_subnet_ids
  db_security_group_id        = module.security.db_security_group_id
  redis_security_group_id     = module.security.redis_security_group_id
  rds_proxy_security_group_id = module.security.rds_proxy_security_group_id

  db_name           = "ticketrush"
  db_instance_class = var.db_instance_class
  db_multi_az       = true

  # Destroy-friendly demo database.
  db_skip_final_snapshot = true
  db_deletion_protection = false
  enable_rds_proxy       = false

  redis_node_type          = var.redis_node_type
  redis_num_cache_clusters = 2
  redis_multi_az           = true

  secret_recovery_window_days = 0
  admin_password              = var.admin_password

  tags = local.common_tags
}

module "edge" {
  source = "../../modules/edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix   = local.name_prefix
  environment   = var.environment
  config_prefix = local.config_prefix

  domain_name = var.domain_name
  subdomain   = var.subdomain

  vpc_id = module.network.vpc_id

  # Public ALB in the public subnets; CloudFront reaches it through the
  # CloudFront origin-facing managed prefix list.
  alb_subnet_ids          = module.network.public_subnet_ids
  alb_scheme              = "internet-facing"
  alb_security_group_id   = module.security.alb_security_group_id
  enable_vpc_origin       = false
  enable_waf              = false
  alb_deletion_protection = false

  frontend_bucket_prefix = local.frontend_bucket_prefix
  media_bucket_prefix    = local.media_bucket_prefix
  media_cors_origins     = local.browser_origins

  force_destroy_buckets  = true
  force_destroy_dns_zone = true
  cloudfront_price_class = var.cloudfront_price_class

  tags = local.common_tags
}

module "compute" {
  source = "../../modules/compute"

  # Wait for the instance role policy and profile to exist before instances
  # start reading Secrets Manager and SSM.
  depends_on = [module.security]

  name_prefix   = local.name_prefix
  config_prefix = local.config_prefix

  app_subnet_ids        = module.network.app_subnet_ids
  app_security_group_id = module.security.app_security_group_id
  instance_profile_name = module.security.instance_profile_name
  target_group_arn      = module.edge.target_group_arn

  instance_type    = var.instance_type
  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  image_tag_default = var.image_tag

  db_url            = "jdbc:postgresql://${module.data.db_address}:${module.data.db_port}/${module.data.db_name}?sslmode=require"
  db_secret_name    = module.data.db_secret_name
  redis_host        = module.data.redis_primary_endpoint
  redis_port        = module.data.redis_port
  redis_secret_name = module.data.redis_secret_name
  jwt_secret_name   = module.data.jwt_secret_name
  admin_secret_name = module.data.admin_secret_name
  admin_email       = var.admin_email

  app_fqdn             = module.edge.app_fqdn
  media_bucket_name    = module.edge.media_bucket_name
  media_region         = var.aws_region
  cors_allowed_origins = local.browser_origins

  log_retention_days = var.log_retention_days
  ecr_force_delete   = true

  tags = local.common_tags
}

module "observability" {
  source = "../../modules/observability"

  name_prefix = local.name_prefix
  alarm_email = var.alarm_email

  alb_arn_suffix             = module.edge.alb_arn_suffix
  target_group_arn_suffix    = module.edge.target_group_arn_suffix
  autoscaling_group_name     = module.compute.autoscaling_group_name
  db_instance_id             = module.data.db_instance_id
  redis_replication_group_id = module.data.redis_replication_group_id

  enable_dashboard = var.enable_dashboard

  tags = local.common_tags
}

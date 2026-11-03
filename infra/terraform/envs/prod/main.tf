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

  app_fqdn = "${var.subdomain}.${var.domain_name}"

  browser_origins = [
    "https://${local.app_fqdn}",
  ]

  optional_feature_flags = {
    shield_advanced = var.enable_shield_advanced
    aws_backup      = var.enable_aws_backup
    cloudtrail      = var.enable_cloudtrail
    guardduty       = var.enable_guardduty
    config          = var.enable_config
  }
}

module "network" {
  source = "../../modules/network"

  name_prefix = local.name_prefix

  vpc_cidr = "10.0.0.0/16"

  public_subnet_cidrs = ["10.0.0.0/24", "10.0.1.0/24"]
  app_subnet_cidrs    = ["10.0.10.0/24", "10.0.11.0/24"]
  data_subnet_cidrs   = ["10.0.20.0/24", "10.0.21.0/24"]

  nat_gateway_count          = var.nat_gateway_count
  enable_interface_endpoints = var.enable_interface_endpoints

  tags = local.common_tags
}

module "security" {
  source = "../../modules/security"

  name_prefix         = local.name_prefix
  config_prefix       = local.config_prefix
  vpc_id              = module.network.vpc_id
  vpc_cidr            = module.network.vpc_cidr
  media_bucket_prefix = local.media_bucket_prefix

  enable_vpc_origin = var.enable_vpc_origin

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

  db_backup_retention_period = var.db_backup_retention_period
  db_skip_final_snapshot     = false
  db_deletion_protection     = true
  db_apply_immediately       = false

  enable_rds_proxy = true

  redis_node_type          = var.redis_node_type
  redis_num_cache_clusters = 2
  redis_multi_az           = true

  secret_recovery_window_days = 30

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

  # Private ALB in the application subnets by default, reachable only through a
  # CloudFront VPC origin. Setting enable_vpc_origin=false falls back to a
  # public ALB in the public subnets for troubleshooting/comparison.
  alb_subnet_ids          = var.enable_vpc_origin ? module.network.app_subnet_ids : module.network.public_subnet_ids
  alb_scheme              = var.enable_vpc_origin ? "internal" : "internet-facing"
  alb_security_group_id   = module.security.alb_security_group_id
  enable_vpc_origin       = var.enable_vpc_origin
  enable_waf              = var.enable_waf
  waf_rate_limit          = var.waf_rate_limit
  alb_deletion_protection = true

  frontend_bucket_prefix = local.frontend_bucket_prefix
  media_bucket_prefix    = local.media_bucket_prefix
  media_cors_origins     = local.browser_origins

  force_destroy_buckets  = false
  force_destroy_dns_zone = false
  cloudfront_price_class = var.cloudfront_price_class

  tags = local.common_tags
}

module "compute" {
  source = "../../modules/compute"

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

  # RDS Proxy requires TLS.
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
  ecr_force_delete   = false

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

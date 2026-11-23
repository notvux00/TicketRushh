data "aws_availability_zones" "available" {
  state = "available"

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

data "aws_region" "current" {}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  tags = merge(var.tags, {
    Component = "network"
  })
}

resource "aws_vpc" "this" {
  cidr_block                       = var.vpc_cidr
  assign_generated_ipv6_cidr_block = true
  enable_dns_support               = true
  enable_dns_hostnames             = true

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

# -----------------------------------------------------------------------------
# Subnets
# -----------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                          = aws_vpc.this.id
  cidr_block                      = var.public_subnet_cidrs[count.index]
  ipv6_cidr_block                 = cidrsubnet(aws_vpc.this.ipv6_cidr_block, 8, count.index)
  availability_zone               = local.azs[count.index % length(local.azs)]
  map_public_ip_on_launch         = false
  assign_ipv6_address_on_creation = false

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-public-${local.azs[count.index % length(local.azs)]}"
    Tier = "public"
  })
}

resource "aws_subnet" "app" {
  count = length(var.app_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.app_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index % length(local.azs)]
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-app-${local.azs[count.index % length(local.azs)]}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "data" {
  count = length(var.data_subnet_cidrs)

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.data_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index % length(local.azs)]
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-data-${local.azs[count.index % length(local.azs)]}"
    Tier = "private-data"
  })
}

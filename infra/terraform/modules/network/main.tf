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

# -----------------------------------------------------------------------------
# Internet and NAT
# -----------------------------------------------------------------------------

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

resource "aws_eip" "nat" {
  count = var.nat_gateway_count

  domain = "vpc"

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  count = var.nat_gateway_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index % length(aws_subnet.public)].id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-nat-${count.index + 1}"
    AZ   = local.azs[count.index % length(local.azs)]
  })

  depends_on = [aws_internet_gateway.this]
}

# -----------------------------------------------------------------------------
# Route tables
# -----------------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-public"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route" "public_ipv6" {
  route_table_id              = aws_route_table.public.id
  destination_ipv6_cidr_block = "::/0"
  gateway_id                  = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "app" {
  count = length(aws_subnet.app)

  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-app-${local.azs[count.index % length(local.azs)]}"
  })
}

resource "aws_route" "app_nat" {
  count = var.nat_gateway_count > 0 ? length(aws_subnet.app) : 0

  route_table_id         = aws_route_table.app[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[count.index % var.nat_gateway_count].id
}

resource "aws_route_table_association" "app" {
  count = length(aws_subnet.app)

  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.app[count.index].id
}

# Data subnets are intentionally isolated: no default route, only the local VPC
# route. RDS and ElastiCache do not need internet egress.
resource "aws_route_table" "data" {
  count = length(aws_subnet.data)

  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-data-${local.azs[count.index % length(local.azs)]}"
  })
}

resource "aws_route_table_association" "data" {
  count = length(aws_subnet.data)

  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.data[count.index].id
}

# -----------------------------------------------------------------------------
# VPC endpoints
# -----------------------------------------------------------------------------

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.app[*].id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-s3-gateway"
  })
}

resource "aws_security_group" "endpoints" {
  count = var.enable_interface_endpoints ? 1 : 0

  name        = "${var.name_prefix}-vpce"
  description = "HTTPS access to interface VPC endpoints"
  vpc_id      = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-vpce"
  })
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_https" {
  count = var.enable_interface_endpoints ? 1 : 0

  security_group_id = aws_security_group.endpoints[0].id
  description       = "HTTPS from the VPC CIDR"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "endpoints_all" {
  count = var.enable_interface_endpoints ? 1 : 0

  security_group_id = aws_security_group.endpoints[0].id
  description       = "Endpoint response traffic"
  cidr_ipv4         = var.vpc_cidr
  ip_protocol       = "-1"
}

resource "aws_vpc_endpoint" "interface" {
  for_each = var.enable_interface_endpoints ? toset(var.interface_endpoint_services) : toset([])

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.app[*].id
  security_group_ids  = [aws_security_group.endpoints[0].id]
  private_dns_enabled = true

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-${replace(each.value, ".", "-")}"
  })
}

output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "availability_zones" {
  description = "Availability zones used by the subnets."
  value       = local.azs
}

output "public_subnet_ids" {
  description = "Public subnet IDs, ordered by AZ."
  value       = aws_subnet.public[*].id
}

output "app_subnet_ids" {
  description = "Private application subnet IDs, ordered by AZ."
  value       = aws_subnet.app[*].id
}

output "data_subnet_ids" {
  description = "Private data subnet IDs, ordered by AZ."
  value       = aws_subnet.data[*].id
}

output "public_route_table_id" {
  description = "Public route table ID."
  value       = aws_route_table.public.id
}

output "app_route_table_ids" {
  description = "Private application route table IDs."
  value       = aws_route_table.app[*].id
}

output "data_route_table_ids" {
  description = "Private data route table IDs (no internet route)."
  value       = aws_route_table.data[*].id
}

output "nat_gateway_ids" {
  description = "NAT gateway IDs."
  value       = aws_nat_gateway.this[*].id
}

output "s3_gateway_endpoint_id" {
  description = "S3 gateway VPC endpoint ID."
  value       = aws_vpc_endpoint.s3.id
}

output "interface_endpoint_ids" {
  description = "Optional interface VPC endpoint IDs."
  value       = { for name, endpoint in aws_vpc_endpoint.interface : name => endpoint.id }
}

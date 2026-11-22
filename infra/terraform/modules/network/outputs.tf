# Role 1 outputs are placeholders in this local scaffold.

output "vpc_id" {
  description = "VPC ID."
  value       = null
}

output "vpc_cidr" {
  description = "VPC CIDR block."
  value       = null
}

output "availability_zones" {
  description = "Availability zones used by the subnets."
  value       = null
}

output "public_subnet_ids" {
  description = "Public subnet IDs, ordered by AZ."
  value       = null
}

output "app_subnet_ids" {
  description = "Private application subnet IDs, ordered by AZ."
  value       = null
}

output "data_subnet_ids" {
  description = "Private data subnet IDs, ordered by AZ."
  value       = null
}

output "public_route_table_id" {
  description = "Public route table ID."
  value       = null
}

output "app_route_table_ids" {
  description = "Private application route table IDs."
  value       = null
}

output "data_route_table_ids" {
  description = "Private data route table IDs (no internet route)."
  value       = null
}

output "nat_gateway_ids" {
  description = "NAT gateway IDs."
  value       = null
}

output "s3_gateway_endpoint_id" {
  description = "S3 gateway VPC endpoint ID."
  value       = null
}

output "interface_endpoint_ids" {
  description = "Optional interface VPC endpoint IDs."
  value       = null
}

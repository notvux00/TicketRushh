terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.17"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ACM certificates for CloudFront and CloudFront-scoped WAF must be created in
# us-east-1, regardless of the application region.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

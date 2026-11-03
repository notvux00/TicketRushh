# -----------------------------------------------------------------------------
# Public hosted zone for the delegated subdomain
# -----------------------------------------------------------------------------

resource "aws_route53_zone" "this" {
  name          = local.app_fqdn
  comment       = "TicketRush ${var.environment} (delegated from ${var.domain_name})"
  force_destroy = var.force_destroy_dns_zone

  tags = merge(local.tags, {
    Name = local.app_fqdn
  })
}

# -----------------------------------------------------------------------------
# CloudFront certificate (must live in us-east-1)
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name       = local.app_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.tags, {
    Name = local.app_fqdn
  })
}

resource "aws_route53_record" "cloudfront_cert_validation" {
  for_each = {
    for option in aws_acm_certificate.cloudfront.domain_validation_options : option.domain_name => option
  }

  zone_id         = aws_route53_zone.this.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for record in aws_route53_record.cloudfront_cert_validation : record.fqdn]

  timeouts {
    create = "30m"
  }
}

# -----------------------------------------------------------------------------
# ALB origin certificate (regional)
# -----------------------------------------------------------------------------

resource "aws_route53_record" "alb_cert_validation" {
  for_each = {
    for option in aws_acm_certificate.alb.domain_validation_options : option.domain_name => option
  }

  zone_id         = aws_route53_zone.this.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "alb" {
  certificate_arn         = aws_acm_certificate.alb.arn
  validation_record_fqdns = [for record in aws_route53_record.alb_cert_validation : record.fqdn]

  timeouts {
    create = "30m"
  }
}

# -----------------------------------------------------------------------------
# Application and origin aliases
# -----------------------------------------------------------------------------

resource "aws_route53_record" "app_ipv4" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.app_fqdn
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "app_ipv6" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.app_fqdn
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "origin_ipv4" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.origin_fqdn
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}


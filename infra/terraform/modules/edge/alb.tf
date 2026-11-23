locals {
  app_fqdn    = "${var.subdomain}.${var.domain_name}"
  origin_fqdn = "origin.${local.app_fqdn}"

  tags = merge(var.tags, {
    Component = "edge"
  })
}

# -----------------------------------------------------------------------------
# Certificates and HTTPS listener
# -----------------------------------------------------------------------------

resource "aws_acm_certificate" "alb" {
  domain_name       = local.origin_fqdn
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.tags, {
    Name = local.origin_fqdn
  })
}

locals {
  app_fqdn    = "${var.subdomain}.${var.domain_name}"
  origin_fqdn = "origin.${local.app_fqdn}"

  tags = merge(var.tags, {
    Component = "edge"
  })
}

# Scaffold: add the ALB, origin verification and target group.

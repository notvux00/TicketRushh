data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# -----------------------------------------------------------------------------
# Private S3 buckets
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "frontend" {
  bucket_prefix = var.frontend_bucket_prefix
  force_destroy = var.force_destroy_buckets

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-frontend"
    Tier = "frontend-assets"
  })
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "media" {
  bucket_prefix = var.media_bucket_prefix
  force_destroy = var.force_destroy_buckets

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-media"
    Tier = "media"
  })
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Browser uploads use presigned S3 PUT URLs, so CORS is configured on the bucket
# itself rather than on CloudFront.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    id              = "presigned-browser-upload"
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD", "POST"]
    allowed_origins = var.media_cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# -----------------------------------------------------------------------------
# Origin access control
# -----------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.name_prefix}-frontend-oac"
  description                       = "OAC for the TicketRush frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.name_prefix}-media-oac"
  description                       = "OAC for the TicketRush media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -----------------------------------------------------------------------------
# SPA fallback and security headers
# -----------------------------------------------------------------------------

resource "aws_cloudfront_function" "spa" {
  name    = "${var.name_prefix}-spa"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite extension-less React Router paths to index.html"
  publish = true
  code    = file("${path.module}/spa_fallback.js")
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${var.name_prefix}-security-headers"
  comment = "HSTS and browser hardening headers for TicketRush"

  security_headers_config {
    content_security_policy {
      content_security_policy = join("; ", [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data: blob: https://picsum.photos https://images.unsplash.com",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "media-src 'self' blob:",
        "connect-src 'self' https://${local.app_fqdn} wss://${local.app_fqdn}",
      ])
      override = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    xss_protection {
      protection = true
      mode_block = true
      override   = true
    }
  }
}

# -----------------------------------------------------------------------------
# CloudFront distribution
# -----------------------------------------------------------------------------

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "TicketRush ${var.environment}"
  default_root_object = "index.html"
  aliases             = [local.app_fqdn]
  price_class         = var.cloudfront_price_class
  http_version        = "http2and3"
  web_acl_id          = var.enable_waf ? one(aws_wafv2_web_acl.this[*].arn) : null

  origin {
    origin_id                = "frontend"
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    origin_id                = "media"
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  origin {
    origin_id = "alb"
    # Use the ACM certificate's hostname so CloudFront's TLS SNI/Host header
    # matches the ALB certificate. Route 53 points this name at the ALB.
    domain_name = local.origin_fqdn

    custom_header {
      name  = var.origin_verify_header_name
      value = random_password.origin_verify.result
    }

    dynamic "custom_origin_config" {
      for_each = var.enable_vpc_origin ? [] : [1]

      content {
        http_port                = 80
        https_port               = 443
        origin_protocol_policy   = "https-only"
        origin_ssl_protocols     = ["TLSv1.2"]
        origin_read_timeout      = 120
        origin_keepalive_timeout = 5
      }
    }

    dynamic "vpc_origin_config" {
      for_each = var.enable_vpc_origin ? [1] : []

      content {
        vpc_origin_id            = aws_cloudfront_vpc_origin.this[0].id
        origin_read_timeout      = 120
        origin_keepalive_timeout = 5
      }
    }
  }

  default_cache_behavior {
    target_origin_id       = "frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa.arn
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # WebSocket upgrade requests must not be cached and need all viewer headers.
  ordered_cache_behavior {
    path_pattern           = "/ws*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  ordered_cache_behavior {
    path_pattern           = "/media/*"
    target_origin_id       = "media"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # No distribution-wide custom error responses: they would also rewrite 403/404
  # responses from /api/*. The CloudFront Function handles SPA routes instead.
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate_validation.cloudfront.certificate_arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = merge(local.tags, {
    Name = "${var.name_prefix}-cloudfront"
  })

  depends_on = [
    aws_lb_listener.https,
    aws_lb_listener_rule.cloudfront_only,
    aws_route53_record.origin_ipv4,
  ]
}

# -----------------------------------------------------------------------------
# Bucket policies: only this distribution may read through OAC
# -----------------------------------------------------------------------------

data "aws_iam_policy_document" "frontend" {
  statement {
    sid    = "AllowCloudFrontReadOnly"
    effect = "Allow"

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend.json
}

data "aws_iam_policy_document" "media" {
  statement {
    sid    = "AllowCloudFrontReadOnly"
    effect = "Allow"

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = data.aws_iam_policy_document.media.json
}

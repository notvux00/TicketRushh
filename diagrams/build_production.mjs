// TicketRush — AWS-native PRODUCTION architecture + CI/CD
// Generated with drawio-ai-kit. No hardcoded coordinates: layout engine computes geometry.
import { writeFileSync } from "node:fs";
import {
  Diagram,
  group,
  frame,
  icon,
  box,
  phantom,
  band,
  renderTree,
} from "drawio-ai-kit";

const d = new Diagram("network");

// ─────────────────────────────────────────────────────────────
// Availability Zone template: Public → Private App → Private Data
// ─────────────────────────────────────────────────────────────
const az = (suffix, opts = {}) =>
  group(`az_${suffix}`, "group_availability_zone", `Availability Zone ${suffix.toUpperCase()}`, { dir: "col", gap: 14 }, [
    group(`pub_${suffix}`, "group_subnet", "Public Subnet", { dir: "col", gap: 8 }, [
      ...(opts.nat
        ? [icon(`nat_${suffix}`, "nat_gateway", "NAT Gateway\n(1 per AZ)")]
        : [box(`pub_${suffix}_note`, "ALB spans AZ A/B", { w: 170, h: 54 })]),
    ]),
    group(`app_${suffix}`, "group_subnet", "Private App Subnet", { dir: "col", gap: 8 }, [
      icon(`ec2_${suffix}`, "ec2", "EC2 · Docker\nSpring Boot (ASG)\nprivate · no public IP"),
    ]),
    group(`data_${suffix}`, "group_subnet", "Private Data Subnet · Cache → DB", { dir: "col", gap: 8 }, [
      icon(`redis_${suffix}`, "elasticache_for_redis", opts.redisLabel),
      ...(opts.proxy ? [icon(`rds_proxy_${suffix}`, "rds_proxy", "RDS Proxy")] : []),
      icon(`rds_${suffix}`, "rds", opts.rdsLabel),
    ]),
  ]);

// ─────────────────────────────────────────────────────────────
// AWS Cloud / Region / VPC
// ─────────────────────────────────────────────────────────────
const vpc = group("vpc", "group_vpc", "VPC 10.0.0.0/16", { dir: "col", gap: 18, align: "center" }, [
  icon("igw", "internet_gateway", "Internet Gateway"),
  icon("alb", "application_load_balancer", "Application Load Balancer\nprivate · CloudFront VPC Origin"),
  phantom("az_row", "", { dir: "row", gap: 34, align: "top", header: 0 }, [
    az("a", {
      nat: true,
      proxy: true,
      rdsLabel: "RDS Primary\nPostgreSQL Multi-AZ",
      redisLabel: "Redis Primary",
    }),
    az("b", {
      nat: true,
      rdsLabel: "RDS Standby\n(Multi-AZ)",
      redisLabel: "Redis Replica",
    }),
  ]),
  phantom("asg_note_row", "", { dir: "row", gap: 16, align: "center", header: 0 }, [
    icon("asg", "auto_scaling2", "Auto Scaling Group\nmin 3 · max 10"),
    box("asg_note", "ALB → ASG → EC2\nHealth: /actuator/health\nALB private: VPC Origin\nNo public origin", { w: 250, h: 72 }),
  ]),
]);

const shared = group("shared", null, "Shared / managed services", { dir: "col", gap: 12, fill: "#FFFFFF", stroke: "#999999" }, [
  phantom("shared_a", "", { dir: "row", gap: 14, header: 0 }, [
    icon("ecr", "ecr", "ECR"),
    icon("secrets", "secrets_manager", "Secrets Manager"),
    icon("kms", "key_management_service", "KMS"),
    icon("iam", "identity_and_access_management", "IAM Role"),
  ]),
  phantom("shared_b", "", { dir: "row", gap: 14, header: 0 }, [
    icon("ssm", "systems_manager", "SSM Parameter Store"),
    icon("ebs", "elastic_block_store", "EBS gp3"),
    icon("ddb", "dynamodb", "DynamoDB\nTerraform lock"),
  ]),
  phantom("shared_c", "", { dir: "row", gap: 14, header: 0 }, [
    icon("backup", "backup", "AWS Backup"),
    icon("cloudtrail", "cloudtrail", "CloudTrail"),
    icon("guardduty", "guardduty", "GuardDuty"),
    icon("config", "config", "AWS Config"),
  ]),
  box("endpoints_note", "VPC endpoints: S3 · ECR · Secrets · Logs · SSM", { w: 360, h: 38 }),
]);

const region = group("region", "group_region", "AWS Region · ap-southeast-1", { dir: "row", gap: 36, align: "top" }, [
  vpc,
  shared,
]);

// ─────────────────────────────────────────────────────────────
// Cross-cutting observability band
// ─────────────────────────────────────────────────────────────
const obs = band("obs", "Observability & alerts", [
  icon("cw_logs", "cloudwatch_logs", "CloudWatch Logs"),
  icon("cw_metrics", "cloudwatch_2", "Metrics / Alarms"),
  icon("sns_alert", "sns", "SNS → Email"),
  box("obs_note", "Alarms: CloudFront/ALB 5xx · p95\nCPU · RDS · Redis · WAF", { w: 260, h: 52 }),
]);

const dr = band("dr", "Backup & DR (production)", [
  icon("dr_backup", "backup", "AWS Backup"),
  icon("dr_s3", "s3", "S3 CRR"),
  icon("dr_rds", "rds", "RDS snapshot"),
  box("dr_note", "Cross-region DR optional\nRDS read replica / snapshot copy · S3 CRR", { w: 320, h: 46 }),
]);

const cloud = group("cloud", "group_aws_cloud_alt", "AWS Cloud", { dir: "col", gap: 22 }, [region, obs, dr]);

// ─────────────────────────────────────────────────────────────
// Edge / global services
// ─────────────────────────────────────────────────────────────
const edge = group("edge", null, "Edge & global services", { dir: "col", gap: 14, fill: "#FFFFFF", stroke: "#8C4FFF" }, [
  icon("r53", "route_53", "Route 53\n(or Cloudflare DNS-only)"),
  icon("cf", "cloudfront", "CloudFront\nCDN + TLS"),
  phantom("edge_sec", "", { dir: "row", gap: 14, header: 0, align: "center" }, [
    icon("waf", "waf", "AWS WAF\nmanaged rules + rate limit"),
    icon("shield_adv", "shield_shield_advanced", "Shield Advanced"),
  ]),
  phantom("s3_row", "", { dir: "row", gap: 18, header: 0, align: "center" }, [
    icon("s3_frontend", "s3", "S3 Frontend\nprivate + OAC"),
    icon("s3_media", "s3", "S3 Media\nprivate + OAC"),
  ]),
  icon("acm", "certificate_manager_3", "ACM us-east-1"),
  box("edge_note", "WAF + Shield Advanced (attached)\n/api/*  /ws*  /media/*\nSPA fallback → index.html\nPrivate ALB via VPC Origin\nTLS: ACM us-east-1", { w: 270, h: 100 }),
]);

// ─────────────────────────────────────────────────────────────
// CI/CD — GitHub Actions + Terraform
// ─────────────────────────────────────────────────────────────
const cicd = frame("cicd", "CI/CD · GitHub Actions + Terraform", { dir: "col", gap: 14 }, [
  phantom("cicd_row1", "", { dir: "row", gap: 16, align: "center", header: 0 }, [
    icon("gh", "github", "GitHub Repo"),
    icon("gha", "githubactions", "GitHub Actions\nCI / Deploy"),
    icon("tf", "terraform", "Terraform\nplan / apply"),
  ]),
  phantom("cicd_row2", "", { dir: "row", gap: 16, align: "center", header: 0 }, [
    icon("ecr_deploy", "ecr", "Push image"),
    icon("s3_deploy", "s3", "Sync frontend"),
    icon("cf_deploy", "cloudfront", "Invalidate CDN"),
    icon("asg_deploy", "auto_scaling2", "ASG refresh"),
    icon("codedeploy", "codedeploy", "Blue/Green"),
  ]),
  box("oidc_note", "GitHub OIDC → IAM Role\nNo long-lived access keys", { w: 260, h: 46 }),
  box("tf_note", "Deploy targets: ECR · S3 · CloudFront · ASG\nTerraform state: S3 + DynamoDB lock\nBlue/Green via CodeDeploy (optional)", { w: 330, h: 64 }),
]);

// ─────────────────────────────────────────────────────────────
// Root layout
// ─────────────────────────────────────────────────────────────
const root = phantom("root", "", { dir: "col", gap: 34, align: "center", header: 0, pad: 12 }, [
  phantom("main_row", "", { dir: "row", gap: 60, align: "center", header: 0 }, [
    box("users", "Users & Admin\nHTTPS / WebSocket", { w: 150, h: 78, fill: "#DAE8FC", stroke: "#6C8EBF", bold: true }),
    edge,
    cloud,
  ]),
  phantom("bottom_row", "", { dir: "row", gap: 40, align: "top", header: 0 }, [
    cicd,
    box("legend", "PRODUCTION PROFILE / NOTES\n\n• WAF managed rules + rate limit; Shield Advanced\n• 2 NAT (one per AZ); private ALB via VPC Origin\n• RDS Proxy · RDS Multi-AZ · Redis Multi-AZ\n• AWS Backup · CloudTrail · GuardDuty · Config\n• ASG 3–10 · S3 private + OAC · no public origin\n• CI/CD: GitHub OIDC → IAM; Terraform; ECR/S3/ASG\n• Cross-region DR optional: RDS snapshot + S3 CRR", { w: 470, h: 170 }),
  ]),
]);

renderTree(d, root, [40, 80]);
d.title("TicketRush — AWS Multi-AZ PRODUCTION architecture + CI/CD (ap-southeast-1)");

// ─────────────────────────────────────────────────────────────
// Main flows + CI/CD flows
// ─────────────────────────────────────────────────────────────
d.link("users", "r53", "DNS", { step: 1 });
d.link("r53", "cf", "", { step: 2 });
d.link("cf", "s3_frontend", "3 static", { role: "fanout" });
d.link("cf", "alb", "VPC Origin /api · /ws", { step: 4 });
d.link("alb", "ec2_a", "", { role: "fanout" });
d.link("alb", "ec2_b", "", { role: "fanout" });
d.link("ec2_a", "rds_proxy_a", "SQL", { step: 5 });
d.link("ec2_b", "rds_proxy_a", "SQL");
d.link("rds_proxy_a", "rds_a", "pooled");
d.link("ec2_a", "redis_a", "cache/lock", { step: 5 });
d.link("ec2_b", "redis_b", "cache/lock");
d.link("rds_a", "rds_b", "Multi-AZ replication", { dash: true });
d.link("redis_a", "redis_b", "replication", { dash: true });
d.link("cf", "s3_media", "", { role: "fanout" });

d.link("gh", "gha", "push/PR");
d.link("gha", "ecr_deploy", "build image");
d.link("gha", "s3_deploy", "build frontend");
d.link("gha", "asg_deploy", "refresh", { dash: true });
d.link("gha", "codedeploy", "blue/green", { dash: true });
d.link("gha", "tf", "plan/apply", { dash: true });

d.link("cw_metrics", "sns_alert", "alarm", { dash: true });
d.link("cicd", "cloud", "deploy", { dash: true });

const res = d.validate();
console.log(
  "VALIDATE:",
  JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }, null, 2)
);

writeFileSync(
  new URL("../../docs/architecture/TicketRush-AWS-Architecture-Production.drawio", import.meta.url),
  d.mxfile("TicketRush — AWS Multi-AZ PRODUCTION + CI/CD")
);
console.log("WROTE ../../docs/architecture/TicketRush-AWS-Architecture-Production.drawio");

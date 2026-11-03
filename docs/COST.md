# Ước tính chi phí

Giá tham khảo `ap-southeast-1`, on-demand, tháng 10/2026. Chỉ dùng để lập bảng báo cáo; kiểm tra lại bằng AWS Pricing Calculator.

## Demo (chạy 24/7)

| Thành phần | USD/tháng |
|---|---:|
| 2 × t3.small | ~30 |
| EBS gp3 40 GB | ~3 |
| 1 NAT Gateway + data | ~35 |
| ALB + LCU | ~20 |
| RDS PostgreSQL Multi-AZ db.t4g.micro + 20 GB | ~28 |
| ElastiCache 2 × cache.t4g.micro | ~23 |
| CloudFront / S3 / Route 53 | ~5 |
| CloudWatch / SNS / Secrets Manager | ~8 |
| **Tổng** | **~150** |

Chạy thử 1–2 ngày rồi destroy: khoảng **10–20 USD**.

## Production (chỉ code, không apply)

| Thành phần | USD/tháng |
|---|---:|
| 3 × t3.medium | ~90 |
| 2 NAT Gateway | ~70 |
| ALB + LCU | ~25 |
| RDS PostgreSQL Multi-AZ + RDS Proxy | ~350 |
| ElastiCache 2 node lớn | ~300 |
| WAF + CloudFront + S3 + logs | ~60 |
| **Tổng** | **~900–1.200** |

Shield Advanced khoảng **3.000 USD/tháng** nên không bật.

## Cách giảm chi phí

- Demo dùng 1 NAT, 2 EC2, RDS Multi-AZ nhỏ.
- Destroy ngay sau demo.
- Không bật CloudTrail/GuardDuty/Config/AWS Backup ở demo.
- Không dùng Shield Advanced.
- CloudFront PriceClass_200 (châu Á) thay vì All.

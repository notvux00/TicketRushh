# Demo script (10 phút)

## 1. Kiến trúc (1 phút)

Mở diagram Production/Demo, trình bày:

- CloudFront + S3 frontend/media + ALB private/public
- ASG EC2 trong private subnet, 2 AZ
- RDS PostgreSQL Multi-AZ, ElastiCache Redis
- IAM role, OIDC, CloudWatch/SNS

## 2. Truy cập ứng dụng (1 phút)

- Mở `https://ticketrush.sudothanh.me`
- Chỉ ra HTTPS, CloudFront, SPA deep link.
- Mở DevTools → Network: `/api/*` đi qua CloudFront, không lộ ALB.

## 3. Admin tạo sự kiện + upload media (2 phút)

- Đăng nhập `admin@gmail.com`.
- Vào `/admin/add-event`.
- Upload ảnh cover → kiểm tra Network: browser PUT trực tiếp tới S3 presigned URL.
- Tạo event, mở event vừa tạo.

## 4. User đặt vé + realtime (2 phút)

- Mở browser 2 (ẩn danh), đăng ký user.
- Vào event → chọn ghế → lock.
- Browser admin/browser khác nhận trạng thái ghế qua WebSocket.
- Chỉ ra log backend có instance ID khác nhau (nếu có) để chứng minh Redis relay.

## 5. Queue (1 phút)

- Admin set threshold thấp, simulate users.
- User vào waiting room, quan sát position và nhận `ACCESS_GRANTED`.
- Chỉ ra scheduler chỉ chạy trên một instance (ShedLock).

## 6. Auto Scaling + alarm (2 phút)

- Chạy k6:

```bash
k6 run tests/load/k6.js
```

- Mở CloudWatch → ASG scale 2 → 3/4.
- Mở SNS email: alarm CPU/5xx đã kích hoạt.
- Mở dashboard ALB/RDS/Redis.

## 7. Bảo mật & chi phí (1 phút)

- EC2 không public IP; SSH không mở; dùng SSM.
- S3 block public; CloudFront OAC.
- IAM role, không access key.
- Bảng cost + AWS Budget.
- Kết thúc: `terraform destroy` (đã chuẩn bị sẵn).

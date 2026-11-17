# Review tổng thể dự án — Round 2

Ngày: 2026-11-17, Asia/Saigon.

## Phạm vi và kết luận

Review toàn bộ trạng thái hiện tại của dự án, gồm cả mã chưa sửa từ round 1:
backend/auth/phân quyền, các đường booking/checkout cũ và mới, QR/check-in,
voucher, dữ liệu/migration, admin/event/zone/seat/analytics, profile/media,
queue/Redis/realtime, frontend/router và CI/CD/Terraform/Lambda.
Đây không phải chỉ review diff của round trước. Các finding ghi lại trạng thái
lúc review; kết quả sửa tiếp theo được ghi ở cuối báo cáo.

Phát hiện **6 vấn đề: 4 P1, 2 P2**. Một trong số đó cho thấy PR1-06 chưa được
đóng hoàn toàn: checkout chuẩn đã có admission guard, nhưng đường booking cũ
vẫn bỏ qua được guard của showtime thực tế bằng showtime ID giả.

## PR2-01 — P1: backend không khởi động với hạn chế CONFIG của ElastiCache

Vị trí: `backend/src/main/java/com/ticketrush/service/RedisKeyExpirationListener.java:44`
và `backend/src/main/java/com/ticketrush/config/RedisConfig.java:14`.

Listener kế thừa `KeyExpirationEventMessageListener` dùng cấu hình mặc định,
không tắt việc đọc/ghi Redis CONFIG. Annotation repository cũng bật listener
ON_STARTUP mà không cấu hình `keyspaceNotificationsConfigParameter` rỗng.
Terraform đã đặt notify-keyspace-events trong parameter group, nhưng việc đó
không ngăn Spring tiếp tục gọi CONFIG GET khi khởi tạo listener.

Tái hiện trên backend đã build, PostgreSQL 16 và Redis 7 riêng: backend khởi
động được khi Redis cho phép lệnh; sau khi cấm CONFIG bằng ACL và khởi động
lại cùng app, process thoát mã 1. Lỗi gốc:

```text
Error creating bean with name 'redisKeyExpirationListener'
RedisCommandExecutionException: NOPERM User default has no permissions
to run the 'config|get' command
```

ElastiCache Redis OSS cấm CONFIG; Spring cũng mô tả yêu cầu tắt thao tác CONFIG
cho môi trường này. Đây là lỗi tương thích deploy, không phải lỗi TLS/mạng đã
được xác nhận trên AWS. Nguồn:
[AWS restricted commands](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/ClientConfig.RestrictedCommands.html),
[Spring Redis expiry listener](https://docs.spring.io/spring-data/data-redis/reference/4.2/redis/redis-repositories/expirations.html).

Đề xuất: đặt cấu hình listener để không gọi CONFIG, cho cả custom listener và
repository listener; quản lý notify-keyspace-events qua parameter group trên
AWS và cấu hình Redis local tường minh. Thêm kiểm tra startup khi CONFIG bị cấm.

## PR2-02 — P1: trang hàng chờ crash sau khi tải xong dữ liệu

Vị trí: `frontend/src/pages/WaitingRoomPage.jsx:3`, `:141`.

File chỉ import `AnimatePresence` từ framer-motion nhưng render nhiều
`motion.div` và `motion.circle`. `motion` không có binding trong scope.
Khi trạng thái loading kết thúc và trang thực sự render hàng chờ, ReferenceError
làm cây React bị unmount. Lint/build hiện tại không bắt được lỗi JSX member này.

Tái hiện bằng Chromium headless, chạy frontend thực và mock HTTP responses cho
user đã đăng nhập/queue đang chờ. Không chụp ảnh; đọc pageerror và DOM:

```json
{"waitingRoomError":"motion is not defined","rootEmpty":true}
```

Đề xuất: import motion hoặc dùng phần tử/component đã được định nghĩa; thêm
kiểm tra render trạng thái hàng chờ sau khi API trả về, không chỉ loading state.

## PR2-03 — P1: API booking cũ bỏ qua showtime, quota và không phát hành QR hợp lệ

Vị trí: `backend/src/main/java/com/ticketrush/service/SeatLockService.java:66`,
`:214`, `:258`; public routes ở `EventController`.

`/api/events/seats/lock` kiểm tra queue theo showtime ID từ client, nhưng service
không xác minh các seat IDs thuộc showtime đó. `/api/events/seats/confirm` cũng
dùng ID client để tìm Redis keys, rồi tải các ghế theo ID mà không kiểm tra
membership/maxTicketsPerOrder. Đây là đường tạo COMPLETED order riêng, không
đi qua invariant của CheckoutService.

Tái hiện bằng USER bình thường:

1. Chọn 5 ghế của suất có giới hạn 4 vé/đơn; bật queue cho suất thật với
   threshold=0, active=100 và không cấp pass cho user.
2. Gửi các ghế đó cùng một showtime UUID khác, không tồn tại, vào legacy lock API.
3. Lock trả HTTP 200/success=true; legacy confirm với cùng request cũng success.
4. DB có 5 tickets được tạo cho ghế của suất thật; cả 5 đều có `qr_payload=NULL`.

Legacy confirm chỉ ghi qr_code dạng URL, scanner hiện tại chỉ nhận payload có
chữ ký TKRUSH. Vì vậy luồng này vừa vượt queue/giới hạn, vừa tạo vé không có
payload scanner chấp nhận. PR1-06 mới được sửa cho đường chuẩn, chưa bao phủ
đường legacy có showtime ID không khớp.

Đề xuất: loại bỏ đường confirm cũ hoặc đưa mọi request qua cùng dịch vụ checkout;
kiểm tra membership của toàn bộ ghế và dùng showtime lấy từ DB trước admission.
Áp dụng cùng giới hạn vé, trạng thái ghế và cơ chế phát hành QR cho mọi đường API.

## PR2-04 — P1: rolling refresh trong workflow dùng option AWS CLI không tồn tại

Vị trí: `.github/workflows/deploy-backend.yml:51`.

Workflow gọi `aws autoscaling start-instance-refresh --auto-rollback ...`.
Lệnh AWS CLI này không có top-level option `--auto-rollback`; AutoRollback nằm
trong object `--preferences`. Vì vậy bước deploy bị chặn ở phân tích arguments,
sau khi image đã push và SSM image tag đã bị đổi.

Bằng chứng: đối chiếu workflow với synopsis và cấu trúc preferences của
[AWS CLI start-instance-refresh](https://docs.aws.amazon.com/cli/latest/reference/autoscaling/start-instance-refresh.html).
Chưa gọi API refresh trên AWS.

Ngoài việc đặt option đúng, rollback còn cần desired configuration và launch
template version cụ thể theo
[AWS rollback requirements](https://docs.aws.amazon.com/autoscaling/ec2/userguide/instance-refresh-rollback.html).
Hiện workflow chỉ đổi image tag SSM mà EC2 đọc lúc boot, nên phải xác định rõ
cách phục hồi image cũ; chỉ thêm AutoRollback=true không làm SSM tag quay lại.

Đề xuất: dùng cấu trúc CLI hợp lệ và chiến lược rollout/rollback nhất quán với
cách chọn image; theo dõi refresh đến trạng thái kết thúc trước khi báo deploy
thành công. Kiểm tra cú pháp CLI riêng trước khi thay đổi SSM.

## PR2-05 — P2: nhiều checkout dùng cùng pass làm queue counter bị giảm thừa

Vị trí: `backend/src/main/java/com/ticketrush/service/VirtualQueueService.java:235`.

`releaseSlot()` chỉ xóa pass nếu pass tồn tại, nhưng luôn DECR active counter.
Một user có thể có hai checkout trên hai ghế khác nhau trong cùng showtime,
trong khi admission chỉ cấp một pass/slot. Confirm/cancel hai đơn sẽ giảm hai
lượt, kể cả khi lần thứ hai không còn pass.

Tái hiện: active=3 với một pass của user và hai pass của user khác; tạo hai
checkout cho user đầu rồi confirm tuần tự. Counter đi từ 3 → 2 → 1; kiểm tra
Redis vẫn có đủ 2 pass của hai user còn lại. Queue guard dùng counter này nên
có thể cho thêm người vào trước ngưỡng thực tế.

Đề xuất: release pass và decrement counter nguyên tử, chỉ giảm nếu pass thực
sự được thu hồi; phối hợp với xử lý expiration để không giảm cùng slot hai lần.
Kiểm tra cả nhiều checkout/tab và pass hết hạn đồng thời với confirm.

## PR2-06 — P2: CloudFront rewrite sai SPA route có dấu slash cuối

Vị trí: `infra/terraform/modules/edge/spa_fallback.js:8`.

Khi URL kết thúc bằng slash, function nối `index.html` vào đường dẫn đó thay
vì rewrite về index ở gốc. Frontend build chỉ tạo index gốc; không có các file
`profile/index.html` hoặc `payment-success/index.html`.

Chạy trực tiếp chính function với output build hiện tại:

| URL | Rewrite | File trong dist |
| --- | --- | --- |
| `/profile` | `/index.html` | Có |
| `/profile/` | `/profile/index.html` | Không |
| `/payment-success/` | `/payment-success/index.html` | Không |

Direct navigation/refresh các SPA route này qua CloudFront sẽ tìm file S3
không tồn tại. React Router/dev server xử lý slash cuối không giúp được vì
HTML chưa được tải. Chưa tái hiện HTTP từ distribution AWS thật.

Đề xuất: chuẩn hóa trailing slash hoặc rewrite SPA paths về `/index.html`,
giữ nguyên đường dẫn assets; kiểm tra cả URL có query string và refresh trực tiếp.

## Baseline và phạm vi kiểm chứng

- Đã build backend hiện tại để tái hiện HTTP/DB/Redis, dùng PostgreSQL/Redis
  container riêng và cổng loopback; không dùng data của dự án khác.
- Backend tests chạy lại: 20 pass, 0 failures/errors/skips theo Surefire.
- Frontend lint/build chạy lại: pass, còn 4 warnings hooks và cảnh báo build cũ.
- Terraform validate demo/prod chạy lại: cả hai pass.
- Kiểm tra frontend dùng Chromium headless với DOM/pageerror và API fixtures;
  không chụp màn hình. Kiểm tra rewrite chạy chính CloudFront JS bằng Node.
- CI/CD AWS được đối chiếu với tài liệu chính thức; không dùng credentials để
  deploy, không chạy refresh/apply hoặc thay đổi state từ xa.
- Rà lại auth/JWT/profile/media, admin/data/analytics và maintenance worker không
  phát hiện thêm lỗi đủ bằng chứng trong lượt này; không coi đó là chứng nhận
  các phần này không còn lỗi.

Các lỗi round 1 khác không bị mở lại chỉ vì tồn tại lỗi mới; các tests hồi quy
đã thêm vẫn được giữ. Riêng queue admission cần bổ sung coverage đường legacy
như PR2-03. Thời điểm chốt review chưa sửa mã nghiệp vụ; phần dưới ghi nhận
lượt sửa theo yêu cầu tiếp theo.

## Kết quả sửa sau round 2

Đã sửa cả 6 finding trong mã nguồn. Chưa deploy hoặc gọi API thay đổi AWS.

| Finding | Bản sửa |
| --- | --- |
| PR2-01 | Custom listener và repository listener không gọi CONFIG. Docker Compose cấu hình notify-keyspace-events=Ex; ElastiCache tiếp tục dùng parameter group Terraform |
| PR2-02 | Import motion qua alias Motion và sửa JSX tương ứng; trang queue render và refresh bình thường |
| PR2-03 | Service giữ ghế xác minh membership, số lượng và trạng thái ghế trước admission/Redis keys. Legacy confirm đi qua createSession + confirmSession trong một transaction; xóa đường tạo order/ticket cũ không có chữ ký |
| PR2-04 | Workflow gọi helper deploy với CLI arguments hợp lệ, chờ Successful, lưu tag trước deploy và phục hồi tag/refresh khi rollout thất bại. Không dựa vào AutoRollback để phục hồi SSM. Image tag duy nhất theo commit/run/attempt; serialize với Terraform theo environment |
| PR2-05 | Grant dùng SET NX + INCR trong Lua; release dùng DEL + DECR trong Lua và chỉ giảm khi xóa được pass. Pass đã hết hạn thuộc trách nhiệm listener, tránh giảm thêm khi confirm/cancel sau đó |
| PR2-06 | SPA route có/không có slash cuối đều rewrite về index gốc; giữ query string và đường dẫn assets |

Legacy confirm giữ response tương thích với trường `orderId`, nhưng không còn
tạo vé bằng URL không có chữ ký. PR1-06 được bổ sung coverage cho cả đường legacy
với showtime giả, vượt quota, ghế không bookable và admission pass thiếu/hợp lệ.

### Kiểm tra sau sửa

- Backend: **25 tests pass**, 0 failures/errors/skips theo Surefire.
  Redis Testcontainer chạy với `CONFIG` bị disable ở server; application context
  vẫn khởi động, và test xác nhận gọi CONFIG thực sự bị từ chối. Có kiểm tra
  expiry event thật, release nhiều lần/đồng thời, grant đồng thời, hai đơn dùng
  chung pass, legacy membership/quota/queue và QR được scanner chấp nhận.
- Deployment helper: **6 tests pass** cho rollout thành công, rollout fail và
  refresh phục hồi, start fail và khôi phục tag, từ chối refresh đang chạy,
  timeout/cancel/recovery và cách truyền boolean flags cho CLI.
- Các request rollout/recovery được đối chiếu offline bằng botocore service
  models, không gọi AWS. Workflow YAML, image tag, CI coverage và concurrency
  group được parse/assert thành công.
- SPA routing: **2 tests Node pass**, gồm route có slash cuối, query string và
  asset paths; được nối vào CI frontend. Tests deploy được nối vào CI riêng và
  chạy trước bước deploy backend.
- Chromium headless với API fixtures: trang waiting room render và refresh
  thành công; `pageErrors=[]`. Xác minh bằng DOM, không screenshot.
- Frontend lint/build: **pass**, còn 4 warnings hooks và cảnh báo build cũ.
- Terraform validate demo/prod và fmt check: **pass**.
- `git diff --check`: **pass**.

### Giới hạn vận hành còn cần xác minh

Chưa chạy rollout/recovery trên ASG thật, chưa publish CloudFront Function hoặc
apply Terraform. Helper phục hồi vẫn phụ thuộc quyền/khả năng kết nối AWS và
image cũ còn trong ECR; recovery thất bại báo lỗi để xử lý thủ công. Deploy fail
luôn kết thúc nonzero kể cả khi recovery thành công. Xem hướng dẫn và quyền
cần có trong `infra/terraform/README.md`.

Các phép thử browser dùng fixtures cho API; không thay thế smoke test frontend
với distribution/backend AWS thật. Thư mục tools/build local được Git bỏ qua.

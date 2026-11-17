# Review tổng thể dự án — Round 3

Ngày: 2026-11-17, Asia/Saigon.

## Phạm vi

Review lại toàn bộ dự án hiện tại: auth/JWT/phân quyền, booking/checkout cũ và
mới, QR/check-in, voucher, queue/Redis/WebSocket, profile/media, admin/event/
zone/seat/analytics, dữ liệu và migrations, frontend/router/session, CI/CD,
Terraform và maintenance worker. Bao gồm cả các phần chưa sửa ở round trước,
không chỉ review diff. Các finding ghi lại trạng thái lúc review; phần cuối
ghi nhận bản sửa theo yêu cầu tiếp theo.

Kết quả: **6 finding — 4 P1, 2 P2**. Bằng chứng HTTP/DB, WebSocket và browser
dùng môi trường local riêng; mô hình lỗi deploy được mô phỏng, không gọi AWS.

## PR3-01 — P1: client chưa đăng nhập có thể phát thông báo WebSocket giả

Vị trí: `backend/src/main/java/com/ticketrush/config/WebSocketConfig.java:22`;
`backend/src/main/java/com/ticketrush/config/SecurityConfig.java:48`.

WebSocket endpoint cho phép anonymous; simple broker nhận `/topic`, nhưng không
có authorization/interceptor cho STOMP inbound để chặn client SEND vào broker
destinations. Cho phép khách đọc trạng thái ghế không đồng nghĩa với việc cho
khách tự phát trạng thái cho các client khác.

Tái hiện bằng hai kết nối WebSocket không có JWT:

1. Cả hai gửi CONNECT và đều được CONNECTED.
2. Client A SUBSCRIBE `/topic/events/showtimes/round3/seats`.
3. Client B SEND vào cùng destination với JSON seatId giả, status=SOLD.
4. A nhận MESSAGE chứa nguyên payload do B phát.

```json
{"anonymousConnected":true,"forgedMessageDelivered":true,
 "body":{"seatId":"UNAUTHENTICATED-SPOOF","status":"SOLD"}}
```

Tác động xác nhận là giả mạo realtime trên client cùng broker, có thể làm giao
diện ghế/hàng chờ hiển thị trạng thái không đến từ backend. Chưa chứng minh
payload này thay đổi dữ liệu PostgreSQL hoặc vượt kiểm tra giao dịch DB.

Đề xuất: chặn client SEND/MESSAGE vào `/topic/**`; chỉ cho server publish.
Xác thực và phân quyền CONNECT/SUBSCRIBE/SEND theo loại destination cần bảo vệ,
giữ quyền đọc anonymous chỉ ở các topic công khai nếu đó là yêu cầu sản phẩm.
Thêm test với hai client, gồm trường hợp client giả mạo thông báo queue.

## PR3-02 — P1: CSP chặn upload trực tiếp lên S3 trong cấu hình AWS

Vị trí: `infra/terraform/modules/edge/s3_cloudfront.tf:154`;
`frontend/src/api/mediaApi.js`, lời gọi fetch PUT uploadUrl.

CloudFront trả CSP `connect-src` chỉ cho self, app HTTPS và app WebSocket.
Backend lại ký URL để browser PUT trực tiếp vào S3 origin, nằm ngoài allowlist.
S3 CORS và chữ ký hợp lệ không khắc phục được việc browser chặn request bởi CSP.

Bằng chứng:

- Gọi API presign bằng USER, với local endpoint override tắt và credentials giả
  dành riêng cho test: SDK sinh origin
  `ticketrush-media.s3.ap-southeast-1.amazonaws.com`. Việc ký URL không gửi PUT.
- Đọc chính CSP expression từ Terraform, đưa header đó vào trang browser test,
  rồi thử fetch PUT tới S3 origin. Chặn network bằng route fixture nếu request
  lọt qua; thực tế không có request upload nào đến network route.

```json
{"error":"Failed to fetch",
 "violations":[{"directive":"connect-src",
 "blocked":"https://ticketrush-media.s3.ap-southeast-1.amazonaws.com/media/avatar/review"}],
 "uploadNetworkRequests":0}
```

Avatar, event cover và trailer đều dùng cùng upload flow, nên cấu hình này làm
các upload AWS bị chặn trước khi tới S3. Không thực hiện upload lên AWS thật.

Đề xuất: đưa đúng S3 upload origin theo bucket/region vào CSP bằng Terraform,
hoặc thiết kế upload cùng origin. Kiểm tra browser với CSP thật cho cả avatar
và media admin; giữ allowlist giới hạn đúng origin cần dùng.

## PR3-03 — P1: checkout chồng ghế xóa vé của đơn còn hiệu lực và giữ nguyên tổng tiền

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckoutService.java:83`,
`:86`; `confirmSession()` sử dụng tổng tiền đã lưu thay vì kiểm tra snapshot vé.

Cleanup draft xóa mọi ticket của order chưa COMPLETED, kể cả PENDING còn hạn.
Redis cho cùng user đổi lock từ order cũ sang order mới. Khi request mới chỉ
chồng một phần số ghế, order cũ còn một phần tickets nhưng total/originalPrice/
discount không được cập nhật hoặc làm mất hiệu lực.

Tái hiện qua HTTP, cùng một USER:

1. Checkout A giữ hai ghế cùng zone, mỗi ghế 2.500.000; tổng A là 5.000.000.
2. Checkout B giữ lại một trong hai ghế đó.
3. GET A trả một ghế còn lại, giá 2.500.000, nhưng totalPrice vẫn là 5.000.000.
4. Confirm A thành công, COMPLETED với một ticket và totalPrice 5.000.000.

```text
originalSeats=2, remainingSeats=1
originalTotal=5000000, remainingSeatValue=2500000
confirmedStatus=COMPLETED, confirmedTotal=5000000
```

Đây là sai lệch dữ liệu đơn/vé được xác nhận; payment flow hiện tại là giả lập,
nên không kết luận đã có tiền ngân hàng bị trừ. Double submit, retry hoặc nhiều
tab có thể đi vào cùng đường API, không cần tài khoản admin.

Đề xuất: không coi PENDING còn hiệu lực là draft rác. Reuse checkout hiện hữu,
từ chối overlap, hoặc hủy toàn bộ phiên cũ một cách nhất quán trước khi thay thế.
Giữ bất biến snapshot ticket/giá của đơn; thêm test overlap một phần và toàn bộ,
retry, cùng user và khác user.

## PR3-04 — P1: múi giờ browser có thể tự hủy checkout vẫn còn hạn

Vị trí: `frontend/src/pages/CheckoutPage.jsx:119`;
`backend/src/main/java/com/ticketrush/model/dto/CheckoutSessionResponse.java`
trả `expiresAt` dưới dạng LocalDateTime không có offset.

Backend dùng giờ Asia/Ho_Chi_Minh, nhưng `new Date(checkout.expiresAt)` diễn giải
chuỗi không offset theo múi giờ của browser. Countdown không so sánh cùng một
instant; browser ở múi giờ đi trước Việt Nam có thể lập tức gọi cancel.

Bằng chứng:

- API thật trả expiresAt dạng `2026-11-17T09:18:01.1351429`, không có Z/offset.
- Chromium timezone Asia/Tokyo, API fixture trả cùng kiểu thời gian Việt Nam,
  được tạo từ thời điểm hiện tại +10 phút. Trang checkout tự gửi cancel một lần
  ngay sau khi tải rồi chuyển về trang event, không có thao tác hủy của người dùng.

```text
browserTimezone=Asia/Tokyo
serverExpiryTenMinutesAhead=2026-11-17T09:19:29
cancelRequests=1
path=/event/tz-event
```

Đề xuất: API trả Instant/OffsetDateTime có offset đúng, frontend tính countdown
từ instant đó. Không gắn Z trực tiếp vào giờ local Việt Nam mà chưa chuyển múi
giờ. Kiểm tra cùng một expiry ở Việt Nam, UTC và múi giờ đi trước Việt Nam.

## PR3-05 — P2: “Vé của tôi” vẫn hiển thị dữ liệu riêng tư sau logout

Vị trí: `frontend/src/pages/MyTickets.jsx:45`, `:53`;
navbar logout cập nhật auth state nhưng không rời trang hiện tại.

MyTickets tải dữ liệu một lần vào component state, không phụ thuộc identity và
không reset khi session thay đổi. Route cũng không có auth guard. Logout xóa
token nhưng danh sách đơn/vé và state modal vẫn còn trên trang đang mở.

Tái hiện bằng Chromium với API fixtures cho account A: mở `/my-tickets`, chờ
đơn `PRIVATE-ORDER-OWNER-A` hiển thị, dùng nút logout thật của navbar. Sau đó:

```json
{"tokenCleared":true,"privateOrderStillVisible":true,"path":"/my-tickets"}
```

Phát hiện này là tồn lưu dữ liệu client sau logout; chưa chứng minh API cho
account khác truy vấn dữ liệu của A. QR đã tải vào state cũng cần được xử lý
khi hết session, thay vì chỉ xóa Authorization token.

Đề xuất: bảo vệ route bằng auth state và loading state; key dữ liệu theo user,
xóa ticket/modal state hoặc unmount khi logout/chuyển identity. Kiểm tra logout,
login lại và chuyển account mà không reload toàn bộ trang.

## PR3-06 — P2: mất response của start refresh khiến recovery bỏ qua refresh đã chạy

Vị trí: `scripts/deploy_backend.py:71`, `:76`.

Refresh ID chỉ được gán sau khi start() trả về thành công. Nếu phía AWS đã nhận
request nhưng response bị mất/CLI gặp timeout, refresh_id vẫn None. Handler lỗi
phục hồi SSM tag nhưng bỏ qua bước query/cancel/recovery refresh, vì tất cả bước
đó nằm trong nhánh yêu cầu đã có ID.

Tái hiện bằng mô hình lỗi không gọi AWS: fake service đánh dấu refresh đã active
trước khi start operation ném TimeoutError; các lời gọi tiếp theo hoạt động lại.

```text
restoredTag=previous
refreshStillActive=True
cancelAttempted=False
calls=[describe-instance-refreshes, get-parameter, put-parameter,
       start-instance-refresh, put-parameter]
```

Workflow vẫn báo fail, nên đây không phải deploy thành công giả. Tuy nhiên
refresh có thể tiếp tục thay instance sau khi tag đã đổi ngược; với image được
đọc ở boot, fleet có nguy cơ lẫn image mới/cũ và không có recovery được thử.
Đây là kiểm chứng state machine bằng mô phỏng, chưa tái hiện trên ASG thật.

Đề xuất: phân biệt lỗi chắc chắn chưa tạo refresh với lỗi kết quả chưa rõ;
reconcile trạng thái ASG sau start error, đối chiếu refresh trước/sau và ownership
của deployment trước khi cancel/phục hồi. Bổ sung test cho request được chấp
nhận nhưng mất response, không chỉ lỗi start xảy ra trước acceptance.

## Baseline và giới hạn

- Backend tests: **25 pass**, 0 failures/errors/skips theo Surefire.
  Deploy helper: **6 pass**. SPA routing: **2 pass**.
- Frontend lint/build: **pass**, còn 4 warnings hooks và cảnh báo build cũ.
  Terraform validate demo/prod: **cả hai pass**. `git diff --check`: **pass**.
- HTTP/DB test dùng PostgreSQL/Redis riêng và một process backend cổng 18087.
  Browser dùng Chromium headless, DOM, pageerror và CSP violation events; không
  chụp hình. API fixtures được ghi rõ ở từng finding.
- Presigned URL chỉ được tạo bằng dummy credentials; không PUT lên S3 thật.
  WebSocket exploit chạy trên broker local. Mô hình lỗi deploy không gọi AWS.
- Các bản sửa round 1/2 không tự động bị mở lại vì các finding mới. Đã rà lại
  các đường check-in, quota, booking legacy, CONFIG, counter và rewrite; các
  tình huống mới ở round này chưa được suite hồi quy hiện tại bao phủ đầy đủ.
- Phần profile/admin/analytics/migrations/Lambda và các cấu hình hạ tầng khác
  cũng được rà; không có thêm finding đủ bằng chứng trong lượt này. Điều đó
  không phải chứng nhận toàn bộ dự án không còn lỗi.

Tại thời điểm chốt review chưa sửa các finding round 3, chưa deploy/apply AWS
hoặc thay đổi state từ xa.
Process backend/frontend và hai container dùng riêng cho review đã được dừng
sau kiểm tra. Chỉ thêm báo cáo này vào source trong lượt review.

## Kết quả sửa sau round 3

Đã sửa cả 6 finding trong mã nguồn; chưa deploy/apply AWS.

| Finding | Bản sửa |
| --- | --- |
| PR3-01 | Inbound channel từ client từ chối SimpMessageType.MESSAGE, bao gồm STOMP SEND/MESSAGE; giữ public subscriptions và server publishing |
| PR3-02 | CSP connect-src thêm đúng regional domain của media bucket lấy từ resource Terraform, không thêm wildcard S3 |
| PR3-03 | Checkout khóa các hàng ghế theo thứ tự ID trong transaction; từ chối ghế thuộc PENDING còn hạn hoặc đơn COMPLETED, chỉ cleanup draft đã hết hiệu lực |
| PR3-04 | expiresAt của checkout trả OffsetDateTime với offset đúng của Asia/Ho_Chi_Minh; browser so sánh cùng một instant |
| PR3-05 | Auth guard cho wallet/profile; account-specific subtree được remount theo user ID, unmount khi logout; bỏ cập nhật ticket state từ request đã mất hiệu lực |
| PR3-06 | Recovery kiểm tra ownership qua SSM tag; khi mất refresh ID, query ASG và chờ refresh chưa rõ ownership kết thúc, không cancel mù; sau đó phục hồi fleet bằng refresh mới với tag cũ |

### Kiểm tra sau sửa

- Tests backend bổ sung overlap một phần/toàn bộ, hai checkout chồng ghế đồng
  thời, snapshot giá/vé, expiry API có offset đúng và WebSocket thật với public
  subscribers/server publisher/client gửi message giả (SEND và MESSAGE).
  **30 tests pass**, 0 failures/errors/skips theo Surefire.
- Deployment helper: **8 tests pass**, bao gồm request được AWS nhận nhưng mất
  response, chờ refresh chưa rõ ID và refresh phục hồi, cùng trường hợp actor
  khác đã đổi SSM tag. Các test này dùng mô phỏng, không gọi AWS.
- Chromium với CSP đọc từ expression Terraform: PUT tới đúng media bucket
  nhận 200 từ network fixture; bucket khác bị CSP chặn và không tới network.
  Không upload S3 thật.
- Chromium wallet: logout chuyển về home và xóa đơn A khỏi DOM; login B rồi mở
  wallet gửi request mới bằng identity B, không hiện lại dữ liệu A.
- Chromium countdown: ở Asia/Ho_Chi_Minh, UTC và Asia/Tokyo đều còn khoảng 10
  phút với cùng expiry +07:00; không có request tự hủy. API fixtures có cùng
  contract offset với API backend đã được integration test xác nhận.
- Frontend lint/build: **pass**, còn 4 warnings hooks và cảnh báo build cũ.
- SPA routing: **2 tests pass**. Terraform validate demo/prod và fmt check:
  **pass**. `git diff --check`: **pass**.

### Giới hạn

Chưa kiểm tra trên distribution/ASG/AWS account thật. CSP cần được apply qua
Terraform; deploy helper vẫn phụ thuộc AWS connectivity, quyền và image cũ còn
trong ECR. Khi không thể xác định trạng thái hoặc ownership an toàn, recovery
báo lỗi để xử lý thủ công. Dữ liệu draft có sai lệch từ trước không được tự
động tính lại hoặc migrate bởi bản sửa này; bản sửa ngăn checkout mới làm sai
snapshot của phiên còn hiệu lực.

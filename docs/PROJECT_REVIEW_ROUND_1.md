# Review tổng thể dự án — Round 1

Ngày: 2026-11-17, Asia/Saigon. Phạm vi: mã hiện tại trong workspace, bao gồm
các thay đổi maintenance worker chưa commit. Các finding dưới đây ghi lại trạng
thái lúc review; phần cuối ghi nhận các bản sửa và kết quả kiểm tra tiếp theo.

## Kết quả

Phát hiện 10 vấn đề: 8 P1 và 2 P2. P1 cần ưu tiên sửa trước khi đưa luồng tương
ứng vào vận hành; P2 cần xử lý nhưng mức ảnh hưởng hoặc khả năng khai thác thấp hơn.

Đã đọc luồng xác thực/phân quyền, booking/checkout, voucher, QR/check-in,
queue/Redis, frontend và cấu hình Terraform/CI/CD. Các lỗi nghiệp vụ bên dưới
được tái hiện qua HTTP với backend thật, PostgreSQL 16 và Redis 7 tách biệt.
Không truy cập hoặc thay đổi AWS. Review này không thay thế kiểm thử tải,
kiểm thử trình duyệt đầy đủ hoặc kiểm toán bảo mật toàn diện.

## PR1-01 — P1: tài khoản USER được phép thực hiện check-in

Vị trí: `backend/src/main/java/com/ticketrush/config/SecurityConfig.java:56`.

`/api/checkin/scan` không thuộc matcher yêu cầu ADMIN hoặc STAFF, nên rơi vào
`.anyRequest().authenticated()`. Controller và service cũng không kiểm tra vai trò.
Một khách hàng đăng ký bình thường có thể đánh dấu vé là đã vào cửa, làm vé bị
từ chối khi nhân viên quét sau đó. Không cần tài khoản nhân viên.

Tái hiện: đăng ký USER qua API và dùng JWT đó gọi scan với QR hợp lệ; nhận
HTTP 200, `status=CHECKED_IN`.

Đề xuất: yêu cầu vai trò soát vé rõ ràng ở backend, thêm kiểm tra âm cho USER
và kiểm tra dương cho vai trò được phép. Không dựa vào việc frontend ẩn trang.

## PR1-02 — P1: hai yêu cầu quét cùng vé đều được chấp nhận

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckinService.java:40`
và `:83`; `repository/TicketRepository.java` không có locking query,
entity `Ticket` không có `@Version`.

Service đọc ACTIVE, kiểm tra và ghi CHECKED_IN bằng các thao tác riêng. Hai
transaction có thể cùng đọc ACTIVE trước khi bên nào commit; khóa ghi thông
thường không khiến transaction thứ hai kiểm tra lại trạng thái đã đọc.

Tái hiện: tạo vé thuộc đơn COMPLETED, giữ khóa hàng vé từ connection kiểm thử,
gửi hai HTTP scan đồng thời, rồi thả khóa. Cả hai phản hồi đều là
`(200, CHECKED_IN)`. Hai lượt vào cửa có thể cùng được báo hợp lệ.

Đề xuất: đọc với pessimistic write lock trong transaction, hoặc chuyển trạng thái
bằng UPDATE có điều kiện và chỉ trả thành công khi số hàng cập nhật bằng 1.

## PR1-03 — P1: QR ở trang thanh toán thành công luôn sai trong luồng hiện tại

Vị trí: `frontend/src/pages/PaymentSuccessPage.jsx:92`;
`frontend/src/pages/CheckoutPage.jsx:242`;
`backend/src/main/java/com/ticketrush/service/CheckoutService.java:394`.

Trang success nhận `selectedSeats` từ checkout qua navigation state. Backend
không đưa `qrPayload` vào seat summary, nên trang tạo QR fallback
`TKRUSH:v1:seat:<seatId>`. Chuỗi này thiếu ticket ID và chữ ký HMAC; bộ kiểm tra
QR yêu cầu cấu trúc năm phần `TKRUSH:v1:<ticketId>:<seatId>:<signature>`.

Tái hiện: lấy checkout của đơn COMPLETED: seat không có `qrPayload`. Gửi đúng
fallback mà trang success sử dụng tới scanner: HTTP 400, `INVALID_SIGNATURE`.
Khách nhìn thấy “Mã cửa vào” nhưng mã đó không dùng để vào cửa được.

Đề xuất: trang success tải vé đã phát hành từ API theo order ID, dùng payload
được backend ký; giữ đường dẫn phục hồi khi refresh. Không tạo QR giả làm fallback.

## PR1-04 — P1: voucher vượt số lượt sử dụng ngay cả khi confirm tuần tự

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckoutService.java:161`.

Giới hạn voucher chỉ được kiểm tra lúc apply. Confirm cộng `usedQuantity` mà
không kiểm tra lại giới hạn, thời hạn hoặc active, cũng không có khóa/conditional
update bảo vệ quota. Hai đơn cùng apply lượt cuối có thể cùng hoàn tất sau đó.

Tái hiện: voucher `total_quantity=1`, `used_quantity=0`; apply vào hai checkout
khác ghế rồi confirm tuần tự. Cả hai trả HTTP 200/COMPLETED; DB kết thúc với
`used_quantity=2`, `total_quantity=1`. Không cần tạo race để xảy ra lỗi.

Đề xuất: xác thực và tiêu thụ quota nguyên tử trong transaction confirm; nếu
quota hoặc điều kiện không còn hợp lệ, yêu cầu tính lại đơn trước khi hoàn tất.

## PR1-05 — P1: GET checkout hết hạn rollback việc dọn dữ liệu nhưng đã mở Redis lock

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckoutService.java:324`
và `:353`.

`getUserOrder()` gọi `expireSession()`: mở khóa Redis, xóa tickets và đánh dấu
EXPIRED. Sau đó `getSession()` gọi `mapSession()`, nhưng hàm này ném exception
khi không còn tickets. Transaction DB rollback; thay đổi Redis không rollback.
Luồng confirm gặp checkout đã hết hạn cũng đi qua nhánh này.

Tái hiện: tạo checkout, chuyển `expires_at` về quá khứ trong DB rồi GET lại.
API trả HTTP 400 với `Checkout session has no seats`; DB vẫn là PENDING và
vẫn có 1 ticket, dù thao tác unlock đã được thực hiện.

Đề xuất: trả response kết thúc phiên hợp lệ mà không phụ thuộc draft tickets
đã xóa; tránh ném exception sau khi dọn phiên trong cùng transaction. Kiểm tra
cả DB và Redis sau GET/confirm của đơn hết hạn.

## PR1-06 — P1: gọi checkout trực tiếp bỏ qua hàng chờ

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckoutService.java:100`.

Queue guard chỉ có ở `/api/events/seats/lock`. Endpoint `/api/orders/checkout`
gọi thẳng `createSession()` rồi `lockSeats()`, không kiểm tra admission pass.
Kiểm tra chuyển hướng trong BookingPage không bảo vệ được API này.

Tái hiện: đặt threshold=0, active=100 và dùng USER không có pass. Lock endpoint
trả `QUEUE_ACCESS_REQUIRED`; checkout với cùng showtime/seat vẫn trả
HTTP 200/PENDING và lấy được Redis lock.

Đề xuất: đặt admission guard dùng chung tại service phục vụ mọi đường tạo
booking; bổ sung kiểm tra trực tiếp API khi queue đang bật và user chưa có pass.

## PR1-07 — P1: workflow Terraform thiếu biến đầu vào bắt buộc

Vị trí: `.github/workflows/terraform.yml:53`;
`infra/terraform/envs/demo/variables.tf:31`, `:43`.

Demo và prod đều yêu cầu `admin_email`, `alarm_email` không có default. Repo chỉ
có file `.tfvars.example`. Workflow không tạo tfvars, không truyền `-var-file`
và không ánh xạ các giá trị GitHub vào `TF_VAR_*`. GitHub configuration variables
không tự trở thành biến môi trường Terraform.

Tái hiện trên cấu hình checkout hiện tại:
`terraform plan -input=false -refresh=false -lock=false` báo hai lỗi
`No value for required variable`: `admin_email` và `alarm_email`.

Đề xuất: truyền tường minh các biến theo GitHub environment, bật chế độ
non-interactive và kiểm tra thiếu cấu hình trước khi plan.

## PR1-08 — P1: workflow Terraform không cấu hình state bền vững

Vị trí: `.github/workflows/terraform.yml:50`;
`infra/terraform/backend.tf.example`.

Không có backend block trong các file Terraform của demo/prod. File S3 backend
chỉ là example, workflow không copy/sinh cấu hình này hoặc khôi phục state.
Vì vậy với source hiện tại, workflow sẽ dùng local state trên hosted runner.
Sau khi sửa lỗi input và apply, state không được lưu bền vững bởi workflow;
lần chạy tiếp theo không biết các tài nguyên đã quản lý, dẫn tới xung đột tên
hoặc tạo thêm tài nguyên. State local từ deploy thủ công cũng không có trên runner.

Bằng chứng: đối chiếu toàn bộ `envs/demo/*.tf`, `envs/prod/*.tf` và các bước
checkout/init/plan/apply; không có backend configuration, state restore hoặc upload.
Chưa chạy apply để tái hiện trên AWS.

Đề xuất: khai báo S3 backend, cấp cấu hình bucket/key/region theo environment
trước init; migrate state hiện hữu có kiểm soát nếu đã deploy thủ công. Bổ sung
state locking và serialization cho các workflow cùng environment.

## PR1-09 — P2: check-in không yêu cầu đơn hàng đã hoàn tất

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckinService.java:72`.

Draft tickets được tạo ACTIVE và ký QR ngay trong `createSession()`, nhưng
scanner chỉ kiểm tra ACTIVE và chữ ký, không kiểm tra order COMPLETED. Việc có
chữ ký chỉ xác nhận nguồn gốc payload, không xác nhận đơn đã hoàn tất.

Tái hiện: tạo checkout PENDING, đọc QR đã ký từ fixture DB, gửi tới scanner;
nhận HTTP 200/CHECKED_IN trong khi order vẫn PENDING. QR ở đây lấy từ DB của
môi trường test: review chưa chứng minh có API public làm lộ QR draft. Vì vậy
không kết luận người dùng có thể lấy QR của đơn chưa thanh toán chỉ bằng API.

Đề xuất: kiểm tra trạng thái order trong cùng transaction check-in và chỉ cho
phép vé được phát hành cho đơn hoàn tất; kiểm tra cả EXPIRED và PENDING.

## PR1-10 — P2: frontend lint làm CI fail

Vị trí: `frontend/src/pages/CheckoutPage.jsx:65`;
`.github/workflows/ci.yml`, bước frontend Lint.

`qrError` được khai báo nhưng không sử dụng. `npm run lint` thoát mã 1 với
`no-unused-vars`, nên job CI fail dù production build vẫn thành công.

Tái hiện: chạy `npm.cmd run lint`: 1 error, 4 warnings. Lỗi chặn là `qrError`;
các warnings còn lại liên quan dependencies của hooks.

Đề xuất: bỏ state/setter không dùng hoặc nối chúng vào luồng xử lý QR lỗi;
sau đó chạy lại đúng lệnh lint trong CI.

## Kết quả kiểm tra và giới hạn

| Kiểm tra | Kết quả |
| --- | --- |
| Backend package (`-DskipTests`) | PASS, dùng để chạy tái hiện HTTP |
| Backend tests (`mvnw.cmd test -q`) | PASS: 10 tests, 0 failures, 0 errors, 0 skipped |
| Frontend build | PASS; cảnh báo bundle size và Browserslist |
| Frontend lint | FAIL: 1 error, 4 warnings |
| Terraform demo plan non-interactive | FAIL: thiếu admin_email, alarm_email |
| HTTP/DB/Redis repro | Các kết quả cụ thể được ghi tại từng finding |

Các fixture chỉ nằm trong hai container review riêng và một process backend
chạy cổng 18087. Không sửa mã ứng dụng để tái hiện; không sử dụng database hay
Redis của dự án khác. Không ghi token hoặc dữ liệu tài khoản thật vào báo cáo.
Các tài nguyên review được dừng sau kiểm tra.

Đề xuất thứ tự sửa: quyền và tính nguyên tử check-in → QR vé đã phát hành →
quota voucher → hết hạn checkout → queue guard → cấu hình deploy → lint.
Các tests hiện có pass không bao phủ đầy đủ những tình huống đã tái hiện ở trên.

## Kết quả sửa sau review

Đã sửa cả 10 finding trong mã nguồn, chưa deploy lên AWS.

| Finding | Thay đổi |
| --- | --- |
| PR1-01 | Backend chỉ cho ADMIN/STAFF gọi `/api/checkin/**`; USER nhận 403 |
| PR1-02 | Scanner đọc vé bằng pessimistic write lock trong transaction; hai scan đồng thời chỉ một thành công |
| PR1-03 | Seat summary chỉ trả QR đã ký cho đơn COMPLETED; success page tải lại checkout theo order ID từ query string, hỗ trợ phục hồi sau refresh, bỏ QR fallback giả |
| PR1-04 | Tiêu thụ quota bằng conditional UPDATE nguyên tử, kiểm tra lại active/thời hạn/quota lúc confirm; khóa order để confirm lặp không tiêu thụ thêm lượt |
| PR1-05 | Phiên EXPIRED không có draft tickets trả summary hợp lệ; GET/confirm/apply/remove không ném lỗi sau khi dọn phiên; frontend hiển thị trạng thái kết thúc dù danh sách ghế rỗng |
| PR1-06 | Admission guard dùng chung được gọi tại checkout và service giữ ghế; request không có pass khi queue bật bị từ chối trước khi tạo đơn |
| PR1-07 | Workflow truyền ADMIN_EMAIL/ALARM_EMAIL/AWS_REGION thành TF_VAR, kiểm tra cấu hình bắt buộc và chạy Terraform non-interactive |
| PR1-08 | Demo/prod khai báo S3 backend với mã hóa; workflow truyền bucket/key/region/DynamoDB lock table và serialize run theo environment; cập nhật gitignore để các backend declaration được đưa vào Git |
| PR1-09 | Scanner kiểm tra order COMPLETED trước khi chấp nhận ticket ACTIVE |
| PR1-10 | Xóa state/setter `qrError` không sử dụng; frontend lint thoát mã 0 |

### Kiểm tra sau sửa

- Backend `mvnw.cmd test -q`: **20 tests pass**, không có failures/errors/skips.
  Suite dùng PostgreSQL 16/Redis 7 qua Testcontainers và Spring Security/MockMvc
  thật. Đã thêm 10 ca hồi quy, bao gồm quét đồng thời, tranh quota cuối,
  confirm lặp, voucher hết hạn/inactive sau apply, bốn đường truy cập checkout
  hết hạn, quyền scanner, QR phát hành và admission pass.
- Các kiểm tra checkout hết hạn xác nhận cả EXPIRED đã commit, draft tickets
  đã xóa và Redis lock đã giải phóng.
- Frontend `npm run lint`: **pass**, còn 4 cảnh báo hooks có sẵn.
  `npm run build`: **pass**, còn cảnh báo bundle size/Browserslist.
- Terraform demo/prod: `init -backend=false` và `validate` **pass**.
  `terraform fmt -check -recursive infra/terraform`: **pass**.
- Workflow: YAML parse và assertions về TF_VAR, S3 init parameters, locking,
  concurrency, non-interactive mode **pass**. Chạy chính Bash config-check bằng
  Git Bash: cấu hình đầy đủ được chấp nhận; cả sáu trường hợp thiếu từng biến
  đều bị từ chối trước init.
- `git diff --check`: **pass**.

### Cấu hình cần có khi deploy

Chưa chạy GitHub Actions, khởi tạo S3 backend từ xa, migrate state hiện có hoặc
apply AWS. Cần cấu hình GitHub environment theo `infra/terraform/README.md`:
`ADMIN_EMAIL`, `ALARM_EMAIL`, `AWS_REGION`, `AWS_TERRAFORM_ROLE_ARN`,
`TF_STATE_BUCKET`, `TF_LOCK_TABLE`; `TF_STATE_REGION` tùy chọn.
Nếu đã có deployment/state local, phải dùng đúng backend hiện hữu và migrate
state trước lần apply từ workflow. Phần này phụ thuộc tài khoản và state thực tế;
không được thay bằng một state trống cho tài nguyên đã tồn tại.

Kiểm tra frontend trong lượt sửa gồm lint/build và hợp đồng API được tests
backend xác nhận; chưa thực hiện kiểm thử tương tác trình duyệt hoặc refresh
trên bản deploy thật. Các lỗi được sửa không thay đổi cơ chế thanh toán giả lập
đang được code ghi rõ là Demo Only.

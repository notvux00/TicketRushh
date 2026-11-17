# Review tổng thể dự án — Round 5

Ngày: 2026-11-17 theo environment của phiên làm việc, Asia/Saigon.

## Phạm vi và kết quả

Review toàn bộ trạng thái workspace, gồm cả code không thay đổi ở round 4:
auth/JWT/phân quyền, profile/media, quản trị event/showtime/zone/seat, checkout
cũ và mới, voucher, QR/check-in, analytics, queue/Redis/WebSocket, frontend
và session/router, migrations, Docker, CI/CD, deploy helper, Terraform demo/prod
và maintenance worker. Giữ nguyên các thay đổi chưa commit của những vòng trước.

Có **4 finding P2** đã tái hiện. Chưa có bằng chứng để báo thêm P1 trong lượt này.
Phần review dưới đây ghi nhận trạng thái trước sửa. Kết quả khắc phục được cập
nhật ở cuối báo cáo; chưa triển khai AWS.

## PR5-01 — P2: giá của vé đã mua thay đổi theo giá khu hiện tại

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckoutService.java:429`;
`backend/src/main/java/com/ticketrush/controller/OrderController.java`, giá của
từng ticket trong `getMyTickets()`;
`backend/src/main/java/com/ticketrush/service/EventService.java:225`.

Order lưu originalPrice/totalPrice khi tạo checkout, nhưng Ticket không lưu giá
tại thời điểm mua. Cả mapSession và ví vé lấy `ticket.seat.zone.price` hiện tại.
Admin vẫn có thể chỉnh giá khu sau khi đã có checkout/vé phát hành. Kết quả là
giá từng vé không còn khớp với giao dịch, và lịch sử giá trên vé bị thay đổi.

Tái hiện qua HTTP với PostgreSQL thật:

1. Tạo event tương lai, khu giá 100.000; mua một vé và confirm COMPLETED.
2. PATCH giá khu thành 900.000.
3. Đọc lại checkout và `/api/orders/my-tickets`.

```json
{"totalCharged":100000.0,"checkoutSeatPrice":900000.0,"walletTicketPrice":900000.0}
```

Một checkout còn PENDING cũng gặp cùng lỗi khi đổi giá khu:

```json
{"totalCharged":100000.0,"checkoutSeatPrice":750000.0}
```

Không chứng minh backend tự tăng số tiền order đã lưu: lỗi xác nhận ở giá dòng
vé/chi tiết đơn và lịch sử giao dịch. Đây là vấn đề khác với PR3-03: các vé của
order vẫn đầy đủ, không có checkout chồng ghế hay draft bị xóa.

Đề xuất: lưu giá gốc từng ticket khi tạo checkout; dùng snapshot đó cho chi tiết
checkout và ví vé. Giữ discount/tổng tiền order theo chính sách hiện tại. Migration
cho vé cũ cần quy tắc đối soát, không thể suy ra chính xác giá từng vé có giảm giá
chỉ bằng giá khu hiện tại.

## PR5-02 — P2: backend vẫn phát hành vé cho suất diễn đã qua

Vị trí: `backend/src/main/java/com/ticketrush/service/CheckoutService.java:51`,
`:145`; `frontend/src/pages/EventDetail.jsx:375`, `:404`.

UI chủ động chặn đặt vé khi startTime đã qua. Tuy nhiên createSession và
confirmSession chỉ kiểm tra ghế, admission, trạng thái/expiry order, lock và
voucher; không kiểm tra thời gian suất diễn. Nhập URL booking trực tiếp hoặc gọi
API có thể bỏ qua chính sách mà nút mua vé đang áp dụng.

Tái hiện: tạo suất diễn bắt đầu từ hai ngày trước và kết thúc hai giờ sau thời
điểm bắt đầu; gọi checkout và confirm bằng USER hợp lệ, ghế AVAILABLE.

```json
{"confirmHTTP":200,"status":"COMPLETED","qrIssued":true}
```

Đề xuất: kiểm tra thời hạn bán vé tại service cho cả tạo và xác nhận checkout,
áp dụng chung cho endpoint mới và endpoint confirm cũ. Chọn rõ chính sách với
checkout tạo trước nhưng xác nhận sau giờ đóng bán; thêm test tại ranh giới giờ.

## PR5-03 — P2: timestamp suất diễn không có offset làm sai trạng thái bán vé theo múi giờ browser

Vị trí: `backend/src/main/java/com/ticketrush/model/dto/EventResponse.java:28`;
`backend/src/main/java/com/ticketrush/model/dto/CheckoutSessionResponse.java:39`;
`frontend/src/utils/eventUtils.js:9`; `frontend/src/pages/MyTickets.jsx:93`.

API vẫn trả startTime/endTime bằng LocalDateTime không có offset. Frontend dùng
`new Date(value)` để xác định thời điểm đã qua, hiển thị giờ và lọc ví vé. Browser
diễn giải chuỗi đó theo múi giờ thiết bị, trong khi giờ nghiệp vụ của app là
Asia/Ho_Chi_Minh. Cùng một suất diễn vì thế có thể được xem là đã hết hạn ở Việt
Nam nhưng còn được mua ở UTC. Người dùng ở múi giờ đi trước Việt Nam có thể bị
đóng nút mua sớm.

Đã xác nhận API thật trả startTime không có Z/offset. Sau đó kiểm tra component
EventDetail thật bằng Chromium, giữ cùng API fixture và cùng instant
`2026-11-17T10:00:00+07:00`; startTime là `2026-11-17T09:00:00`:

| Browser timezone | Parsed instant | Nút mua vé |
| --- | --- | --- |
| Asia/Ho_Chi_Minh | 2026-11-17T02:00:00.000Z | HẾT HẠN ĐẶT VÉ, disabled=true |
| UTC | 2026-11-17T09:00:00.000Z | MUA VÉ NGAY, disabled=false |

Đây không phải lỗi expiresAt của PR3-04 đã sửa; expiresAt hiện có offset đúng.
Finding này là hợp đồng timestamp còn lại của showtime và các consumer tương ứng.

Đề xuất: trả Instant/OffsetDateTime đúng instant cho showtime trên các API public,
checkout và ví vé; thống nhất cách hiển thị giờ địa điểm tổ chức và cách nhập giờ
trong admin. Không đơn thuần gắn Z vào giá trị đang mang giờ Việt Nam. Test cả
UTC, Việt Nam và một múi giờ đi trước Việt Nam.

## PR5-04 — P2: batchSize=0 mở toàn bộ hàng chờ thay vì từ chối hoặc tạm dừng

Vị trí: `backend/src/main/java/com/ticketrush/controller/QueueController.java:51`;
`backend/src/main/java/com/ticketrush/service/VirtualQueueService.java:185`,
`:189`, `:280`.

Endpoint set-batch-size nhận mọi int và lưu thẳng vào Redis. grantNextBatch tính
`toGrant = min(availableSlots, batchSize)` rồi gọi ZRANGE từ 0 đến `toGrant - 1`.
Khi batchSize=0, khoảng 0..-1 có nghĩa là toàn bộ sorted set, nên scheduler cấp
pass cho tất cả người đang chờ. Giá trị âm cũng tạo khoảng chỉ số sai mục đích.

Tái hiện bằng endpoint ADMIN và scheduler thật, Redis 7 thật:

1. Cấu hình batchSize=0, threshold=0 trên một queue fixture riêng.
2. Thêm 5 người giả lập bằng endpoint simulate-users.
3. Chờ một nhịp scheduler và đọc admin/info.

```json
{"configureHTTP":200,"batchSize":0,"admitted":5,"queuedBefore":5}
```

Đây là lỗi cần quyền ADMIN/cấu hình không hợp lệ, không phải bypass của USER.
Nó có thể làm mất cơ chế giới hạn đợt vào khi người vận hành nhập 0 để dừng queue
hoặc một client gửi giá trị lỗi. Max-capacity cũng không được giữ bởi phép range
này nếu toàn bộ queue lớn hơn số slot tính trước.

Đề xuất: xác định zero là invalid hay paused; validate giới hạn ở endpoint và
service, đồng thời return sớm nếu toGrant<=0 trước khi gọi Redis. Kiểm tra số
người được cấp không vượt toGrant; test 0, số âm và giới hạn capacity.

## Kiểm tra và phạm vi đã đối chiếu

| Nhóm | Kiểm tra trong round 5 | Kết quả |
| --- | --- | --- |
| Backend | Maven test; PostgreSQL 16 + Redis 7 qua Testcontainers, gồm V1–V5 | 37 pass, 0 failure/error/skip |
| API/DB probes | Catalog, giá checkout/vé, suất đã qua, cấu hình queue | Tái hiện PR5-01, PR5-02, PR5-04 |
| Browser | EventDetail thật, DOM và network fixtures, hai timezone và clock cố định | Tái hiện PR5-03, không chụp ảnh |
| Frontend | npm run lint; npm run build | Pass, 4 warnings hooks cũ; cảnh báo bundle/Browserslist cũ |
| Deploy helper | Python unittest | 8 pass |
| SPA routing | Node test | 2 pass |
| Maintenance worker | Unit + PostgreSQL integration với temp tables riêng | 5 pass, không skip |
| Terraform | fmt -check -recursive; validate demo và prod | Pass |
| Whitespace | git diff --check | Pass |

Đã đối chiếu thêm policy JWT/role của các controller, profile/media presign,
checkout overlap/ownership/quota/cancel, signed QR/check-in và khóa row,
analytics queries, realtime publish policy, Redis TTL/admission, account guards,
partial update semantics, V5 bảo vệ lịch sử vé/giá, build/container startup,
workflow permissions/concurrency, ASG rollout recovery, S3/CloudFront/CSP,
network/secret wiring và maintenance SQL/transaction. Không có thêm finding đủ
bằng chứng từ các phần này trong lượt review; việc nêu phạm vi không có nghĩa
mọi nhánh đều đã có integration test.

## Giới hạn và trạng thái cuối

- Không deploy/apply, gọi refresh ASG, upload media hoặc thay đổi AWS/state từ xa.
- API probes chạy trên backend local riêng cổng 18087; PostgreSQL/Redis riêng
  cổng 18091/18092. Tài khoản, event, order và queue đều là fixture; không dùng dữ
  liệu/tài khoản người thật. Redis đổi tên CONFIG để đối chiếu môi trường hạn chế.
- Browser timezone dùng dữ liệu API fixture có cùng định dạng đã xác nhận từ
  backend thật; không tuyên bố đã kiểm tra múi giờ trên CloudFront production.
- Không chạy tải lớn hoặc kiểm toán bảo mật độc lập; không suy ra double-sale
  hay thiệt hại thanh toán thật từ các probe trên.
- Phần review ban đầu chỉ thêm báo cáo. Các process/container riêng cho review
  được dừng sau khi hoàn tất kiểm tra.

## Khắc phục sau round 5

Đã sửa **4/4 finding** trong workspace, giữ nguyên công việc của các vòng trước.

| Finding | Thay đổi | Kiểm chứng sau sửa |
| --- | --- | --- |
| PR5-01 | Migration V6 thêm `tickets.unit_price`; checkout mới ghi giá gốc từng vé và JPA không cập nhật lại snapshot. Chi tiết checkout/ví vé đọc snapshot, discount vẫn nằm ở order. | Order hai vé giữ giá từng vé 100.000 khi giá khu đổi sang 900.000 rồi 5.000; áp voucher 1.000 cho tổng 199.000 không làm thay đổi giá gốc. DB từ chối snapshot âm/NaN/Infinity. |
| PR5-02 | Chung policy đóng bán lúc startTime, kiểm tra ở checkout và cả legacy lock/confirm. Deadline checkout là min(10 phút, startTime). Xác nhận kiểm tra lại lịch hiện tại; nếu suất bị dời vào quá khứ thì expire checkout, xóa draft và nhả lock, không tiêu thụ voucher. | Cả ba route từ chối suất đã qua; không sinh order/Redis lock. Checkout gần giờ diễn có deadline đúng startTime. Dời giờ sớm rồi confirm trả EXPIRED, không phát hành QR hay dùng quota. |
| PR5-03 | API event, checkout và ví vé trả giờ suất diễn có offset +07:00. Admin nhận được cả giờ local theo địa điểm và ISO có offset/Z, chuẩn hóa về giờ Việt Nam. Form admin và các chỗ hiển thị vé/lịch dùng giờ địa điểm tổ chức. | Backend round-trip local/+07/Z giữ cùng instant. Test Node chạy trong Việt Nam/UTC/Tokyo; Chromium EventDetail ở cả ba timezone đều chặn suất đã qua và hiển thị cùng 09:00. |
| PR5-04 | Service từ chối batchSize<=0 trước khi ghi Redis; scheduler return sớm khi toGrant<=0 để chịu được config cũ/ghi ngoài ứng dụng. | Endpoint trả 400 cho 0/-1; config Redis 0/-1 không cấp pass. Batch=2 cấp 2/5 người; batch=10 với capacity=3 chỉ cấp 3/5. Test Redis dùng database riêng để không tranh với scheduler. |

### Kết quả kiểm tra cuối

- Backend: **47 tests pass**, 0 failure/error/skip, với PostgreSQL 16 + Redis 7
  qua Testcontainers; Flyway chạy V1–V6. Build package pass.
- Frontend lint/build: **pass**; còn 4 warnings hooks cũ và cảnh báo bundle/
  Browserslist cũ.
- Node: **3 timezone tests + 2 SPA routing tests pass**. Timezone tests đã được
  thêm vào CI frontend.
- Chromium DOM/network: **4 kịch bản pass** — EventDetail tại ba timezone và
  checkout vé cũ có giá chưa xác định. Không chụp ảnh hoặc đọc pixel/canvas.
- Deploy helper: **8 tests pass**. `git diff --check`: pass.
- Không thay đổi Terraform/maintenance worker trong lượt sửa; kết quả kiểm tra
  của chúng ở phần baseline review phía trên, không tính thành test chạy lại.

### Migration và chính sách dữ liệu

- V6 không dùng giá khu hiện tại để điền giá vé cũ. Tất cả vé có trước migration
  giữ `unit_price=NULL` cho tới khi có nguồn đối soát đáng tin cậy; không chia
  tổng order hay discount tùy ý để tạo ra lịch sử đơn giá không có bằng chứng.
- Checkout hiển thị **“Chưa xác định giá gốc”** cho dòng vé cũ thiếu snapshot,
  đồng thời vẫn hiển thị tổng tiền order đã lưu. Đã kiểm tra DOM ở browser UTC.
- Cột nullable cho phép phiên bản backend cũ và mới cùng hoạt động khi rolling
  deployment. Vé do phiên bản cũ tạo vẫn có snapshot chưa xác định; vé do phiên
  bản mới tạo có snapshot ngay khi mở checkout.
- Giữ chính sách hiện tại cho suất chưa công bố startTime (TBA); khi đã có
  startTime thì không cho mở/xác nhận giao dịch từ thời điểm bắt đầu trở đi.
  Các đơn COMPLETED vẫn đọc lại và confirm idempotent như trước.
- Form admin nhập theo giờ Việt Nam; input có offset được đổi về cùng instant,
  không gắn Z lên một giá trị local. Việc lưu timestamp trong DB vẫn theo cấu
  hình Hibernate hiện tại; không đổi dữ liệu lịch đã có bằng migration.
- Chưa deploy/apply hoặc chạy migration trên môi trường từ xa. Vite/Chromium
  dùng kiểm tra đã được dừng; Testcontainers đã dọn container kiểm thử.

# Review tổng thể dự án — Round 4

Ngày: 2026-11-17, Asia/Saigon.

## Phạm vi và kết quả

Review toàn bộ trạng thái hiện tại: auth/JWT/phân quyền, booking/checkout cũ và
mới, voucher, ticket/QR/check-in, quản trị event/zone/seat/giá, profile/media,
queue/Redis/WebSocket, frontend/router/session, migrations, CI/CD, Terraform và
maintenance worker. Bao gồm cả phần chưa sửa, không chỉ diff của round trước.
Phần review bên dưới ghi nhận trạng thái trước sửa; kết quả khắc phục được cập nhật ở cuối báo cáo.

Có **5 finding: 1 P1 và 4 P2**. Ba finding quản trị được tái hiện qua HTTP và
PostgreSQL thật; race profile được tái hiện bằng Chromium/API fixtures; race
unlock dùng chính SeatLockService với Redis mock và interleaving có kiểm soát.
Không gọi AWS để deploy, refresh, upload hoặc thay đổi state.

## PR4-01 — P1: xóa sự kiện làm mất vé đã phát hành và lịch sử check-in

Vị trí: `backend/src/main/java/com/ticketrush/service/EventService.java:200`;
native delete ở `repository/EventRepository.java`; FK audit có ON DELETE CASCADE
trong migration V3.

deleteEvent xóa tickets của event vô điều kiện trước khi xóa seats/zones/
showtimes. Không kiểm tra đơn COMPLETED, không chuyển đơn sang trạng thái hủy/
hoàn tiền và không lưu bản ghi vé đã phát hành để tra cứu. Order vẫn tồn tại
với trạng thái COMPLETED nhưng không còn tickets. Điều này cũng trái với invariant
của API checkout: đơn hoàn tất phải có vé để map response.

Tái hiện trên fixture event ở tương lai, user mua một vé và admin check-in
thành công trước khi xóa event:

```text
DELETE event: 204
orderStatus: COMPLETED
remainingTickets: 0
remainingAuditRows: 0
scan lại QR đã phát hành: 400 / TICKET_NOT_FOUND
```

Đây là hành động bằng tài khoản ADMIN hợp lệ; finding về tính toàn vẹn lịch sử
mua vé và dữ liệu đã phát hành, không phải vượt quyền gọi DELETE. Payment hiện
tại là demo, nên không khẳng định có giao dịch ngân hàng đã diễn ra.

Đề xuất: chặn hard delete khi có đơn/vé đã phát hành, hoặc dùng archive/cancel
flow có trạng thái và xử lý hoàn/hủy rõ ràng mà vẫn bảo toàn lịch sử. Áp dụng
cùng nguyên tắc cho xóa zone vì cascade có thể đi tới tickets. Kiểm tra cả event
chưa bán vé, đã bán và đã check-in.

## PR4-02 — P2: PATCH một phần xóa các trường không được gửi và đổi giới hạn vé

Vị trí: `backend/src/main/java/com/ticketrush/service/EventService.java:147`;
PATCH endpoint ở `controller/AdminEventController.java`.

updateEvent chỉ giữ coverImage khi trường đó null. Các trường description,
venueName, venueAddress và maxTicketsPerOrder được ghi thẳng từ DTO, nên trường
bị bỏ qua trong PATCH thành null trong DB. Với giới hạn vé, null còn khiến
checkout sử dụng fallback 4 thay vì giới hạn đã cấu hình.

Tái hiện:

1. Tạo event có venue/description và maxTicketsPerOrder=1.
2. Checkout hai ghế ban đầu bị từ chối.
3. PATCH chỉ gửi `{ "coverImage": "/media/review-cover" }`.
4. API trả 200; description, venueName và maxTicketsPerOrder đều trở thành null.
5. Checkout hai ghế sau đó trả 200 vì limit đã rơi về default.

Frontend edit hiện gửi PUT với payload đầy đủ; lỗi được xác nhận qua PATCH API
đang được công khai, không kết luận mọi thao tác đổi cover trên UI đều gây lỗi.

Đề xuất: tách semantics PATCH và PUT; chỉ cập nhật field thực sự có trong PATCH,
và phân biệt omitted với explicit null nếu cần hỗ trợ xóa giá trị. Kiểm tra
PATCH từng field không làm mất các field khác hoặc thay đổi booking cap.

## PR4-03 — P2: giá âm tạo được đơn COMPLETED và doanh thu âm

Vị trí: `backend/src/main/java/com/ticketrush/service/ZoneService.java:57`, `:97`;
đường sửa zone ở `service/EventService.java:186`; DTO ZoneRequest không có
constraint cho price và controller không thực hiện validation phù hợp.

Giá được ghi thẳng vào zone, calculateTotal cộng giá đó và confirm giữ nguyên
tổng. Backend không bảo vệ invariant giá/tổng tiền không âm. Thuộc tính min=0
trên input frontend không thay thế validation ở server.

Tái hiện bằng API ADMIN tạo event/zone có price=-100000 rồi USER checkout và
confirm một ghế:

```text
order.status = COMPLETED
order.totalPrice = -100000
analytics HTTP status = 200
analytics.totalRevenue = -100000
```

Đây là lỗi validation và dữ liệu kinh doanh, không phải user thường tự sửa giá
qua request checkout. Chưa có giao dịch thanh toán ngân hàng trong phép thử.

Đề xuất: validation server cho giá không âm/hợp lệ, áp dụng nhất quán ở create
và update; kiểm tra phòng vệ trước khi tạo/confirm order. Cân nhắc constraint DB
sau khi xử lý dữ liệu không hợp lệ đã tồn tại. Không tự biến giá âm thành miễn phí.

## PR4-04 — P2: profile của account cũ có thể ghi đè profile của account đang đăng nhập

Vị trí: `frontend/src/context/AuthContext.jsx:15`, `:16`.

fetchProfile là callback dùng chung, không gắn kết quả với user ID/request
generation. Logout có setProfile(null), nhưng request của A đang chạy vẫn có
thể hoàn tất sau khi B login và gọi setProfile(dataA). Nếu response A đến sau
response B, navbar tiếp tục hiện tên/avatar A dưới session B.

Tái hiện bằng Chromium và delayed API fixtures:

1. Giữ response `/profile` của A chưa trả về.
2. Dùng nút logout và login B thật trên UI.
3. Cho response profile B hoàn tất, navbar hiện PROFILE-B.
4. Thả response A; navbar đổi thành PROFILE-A trong khi token vẫn của B.

```json
{"currentToken":"owner-b-token","displayedProfile":"PROFILE-A",
 "lateOwnerAResponses":2}
```

Đây là state profile dùng chung bị race; wallet route guard được sửa ở round 3
không phải nguyên nhân và không bị kết luận đã hỏng. Chưa chứng minh API backend
trả dữ liệu A cho token B; browser đã nhận dữ liệu A từ request cũ của chính A.

Đề xuất: key profile theo identity, hủy/ignore request cũ bằng user ID và request
generation, reset ngay khi auth đổi. Kiểm tra cả response success lẫn error đến
muộn sau logout/login, refreshProfile và thứ tự response A/B đảo ngược.

## PR4-05 — P2: unlock seat có thể xóa lock mới của người khác

Vị trí: `backend/src/main/java/com/ticketrush/service/SeatLockService.java:121`,
`:124`.

Service GET locker, kiểm tra owner trong Java rồi DEL ở command khác. Nếu key
hết hạn và được user B lấy lại giữa GET và DEL của A, thao tác DEL cũ vẫn xóa
lock của B. Đây là seat lock, khác với queue pass đã được sửa bằng Lua ở round 2.

Kiểm chứng bằng chính SeatLockService đã compile, Mockito Redis adapter và
interleaving có kiểm soát: GET trả owner A đã quan sát, state Redis mô phỏng đổi
sang B trước khi method tiếp tục; DEL của method xóa state B.

```text
LOCK_RACE_RESULT: newerOwnerLockDeleted=true
```

Đây là kiểm chứng logic method với interleaving giả lập, không phải race đã đo
được qua network/TTL thật. Source có hai command riêng nên không có atomicity
ngăn interleaving này. Mất lock có thể làm client mới bị tranh ghế hoặc fail
checkout; chưa chứng minh double-sale vượt constraint của PostgreSQL.

Đề xuất: compare-and-delete nguyên tử bằng Lua, so sánh đầy đủ giá trị lock đã
quan sát (gồm order nếu có), chỉ broadcast AVAILABLE khi thực sự xóa được đúng
lock. Thêm test đổi owner giữa read/delete và key đã hết hạn/không còn tồn tại.

## Baseline và giới hạn

- Backend package được build để chạy các phép thử HTTP/DB trên app thật.
  Backend: **30 tests pass**, 0 failures/errors/skips theo Surefire.
  Deploy helper: **8 tests pass**. SPA routing: **2 tests pass**.
- Frontend lint/build: **pass**, còn 4 warnings hooks và cảnh báo build cũ.
  Terraform validate demo/prod: **cả hai pass**. `git diff --check`: **pass**.
- Chromium chỉ kiểm tra DOM/network events và điều khiển timing của API fixtures;
  không chụp ảnh. Java probe gọi method thật với mock, không chỉnh source để tái hiện.
- Database/Redis của review dùng container riêng và process backend cổng 18087.
  Các bản ghi admin/customer đều là fixture, không dùng tài khoản người thật.
- Đã rà lại WebSocket publish policy, expiry có offset, wallet guard, admission,
  overlap checkout, quota, CONFIG, CSP, routing và workflow/state/rollout.
  Các finding mới không tự động mở lại những trường hợp đã được sửa ở round cũ.
- Các phần auth/media/migrations/analytics/Lambda và hạ tầng khác vẫn nằm trong
  phạm vi rà soát; không có thêm finding đủ bằng chứng trong lượt này. Review
  không thay thế kiểm toán bảo mật, kiểm thử tải hoặc kiểm tra AWS triển khai thật.

## Khắc phục sau review round 4

Đã sửa **5/5 finding** trong workspace; chưa deploy/apply AWS.

| Finding | Thay đổi | Bằng chứng hồi quy |
| --- | --- | --- |
| PR4-01 | Event/zone từ chối xóa khi có vé đã thanh toán, đã check-in hoặc checkout còn hiệu lực. Migration V5 thêm trigger trước DELETE ticket, khóa order để kiểm tra trạng thái khi có thao tác đồng thời. Cancel/expire flush EXPIRED trước khi xóa draft. | HTTP xóa event/zone bị từ chối; vé và ticket_checkins còn nguyên; quét lại trả ALREADY_CHECKED_IN. SQL DELETE trực tiếp vé đã thanh toán/live bị chặn. Catalog chỉ chứa draft hết hạn vẫn xóa được. |
| PR4-02 | Tách PATCH khỏi PUT; chỉ cập nhật trường hiện diện trong JSON, áp dụng cả root, showtime và zone. Explicit null vẫn xóa được giá trị nullable. Khóa event trong transaction khi cập nhật. | Partial PATCH giữ description, venue, limit=1, thời gian suất diễn và giá zone; explicit null description được lưu. |
| PR4-03 | Kiểm tra giá hữu hạn, không âm khi tạo/sửa zone và tạo event; kiểm tra tổng tiền lúc checkout/confirm. V5 thêm CHECK cho zone.price và order.total_price. | HTTP create event/create zone/PUT/PATCH từ chối giá âm; PostgreSQL từ chối số âm, NaN và Infinity; checkout miễn phí hoàn tất được. |
| PR4-04 | Gắn mỗi request profile với identity và version. Đổi session, logout, refresh mới hoặc unmount làm request cũ mất hiệu lực. Initial session promise cũng có version guard. | Chromium giữ phản hồi profile A, logout/login B, rồi trả A thành công hoặc lỗi 500: navbar vẫn PROFILE-B, token vẫn token-B. Cả hai kịch bản pass. |
| PR4-05 | Lua compare-and-delete đối chiếu toàn bộ giá trị lock, gồm order ID; chỉ publish AVAILABLE khi script thực sự xóa đúng khóa. | Test interleaving GET với Redis thật: khóa đổi sang user khác hoặc cùng user nhưng order khác đều giữ nguyên và không broadcast. Kiểm tra thêm đúng owner, sai owner và khóa không còn tồn tại. |

### Kiểm tra sau sửa

- Backend: **37 tests pass**, không failure/error/skip; PostgreSQL 16 và Redis 7 thật qua Testcontainers, gồm migration V5. Build package sau cùng pass.
- Frontend lint/build: **pass**; còn 4 warnings hooks cũ và cảnh báo bundle/Browserslist cũ.
- Browser DOM/network: **2 kịch bản profile race pass**, không chụp ảnh.
- Deploy helper: **8 tests pass**. SPA routing: **2 tests pass**.
- Maintenance worker: **3 unit tests pass**, 2 integration tests opt-in không chạy trong lượt sửa này.
- `git diff --check`: pass. Không có thay đổi Terraform trong lượt sửa; kết quả validate demo/prod ở baseline phía trên.

### Migration và giới hạn

- Timestamp trong trigger dùng UTC, khớp cấu hình `hibernate.jdbc.time_zone=UTC`.
- CHECK dùng `NOT VALID`: không tự sửa dữ liệu cũ. Các bản ghi giá âm/không hữu hạn đã tồn tại trước migration cần đối soát riêng; checkout mới và xác nhận thanh toán có thêm kiểm tra ở service. Có thể VALIDATE CONSTRAINT sau khi xử lý dữ liệu cũ.
- Bản sửa không khôi phục vé/audit đã bị xóa trước đó. Nếu đã gặp trên môi trường thật, cần đối soát order và bản sao lưu.
- Race Redis được điều khiển tại bước GET, còn Lua chạy trên Redis 7 thật; không phải phép đo tranh chấp TTL tự nhiên dưới tải. Browser dùng API fixtures, không gọi tài khoản/backend production.
- Chỉ thay đổi và kiểm tra cục bộ; không deploy/apply, không sửa state từ xa. Testcontainers đã tự dọn các container kiểm thử; Vite và Chromium dùng kiểm tra đã được dừng.

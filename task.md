# TicketRush — Task backlog cải thiện code

> Nguồn: review toàn bộ backend/frontend/infra ngày 2026-11-18.
> Quy trình bắt buộc: xem [AGENT.md](AGENT.md). Không sửa trực tiếp trên `main`.
> Trạng thái: `todo` · `doing` · `review` · `verified` · `merged`.
>
> **Kết quả 2026-11-18:** 25/25 task đã `verified` + merge vào `main`, mỗi task có tag riêng.
> P2-02b hoàn tất phần tách step/modal admin (follow-up cosmetic của P2-02).
> Gate cuối: backend 87 test, frontend lint/build + Playwright 16, node 16, python 12,
> worker 5 (PostgreSQL), Terraform validate demo/prod.

## Quy ước

- Mỗi task làm trên **một nhánh riêng**, đặt tên `task/<ID>-<slug>` tạo từ `origin/main`.
- Chỉ được tạo tag và merge vào `main` sau khi **toàn bộ test gate bắt buộc** trong AGENT.md pass.
- Một task = một commit cuối (hoặc nhiều commit sạch, squash khi merge). Không gộp nhiều ID vào một nhánh nếu không cần.
- Cập nhật cột `Trạng thái` + ghi chú test ngay trong file này ở cuối task.

## Tổng quan

| Nhóm | Số task | Mục tiêu |
| --- | --- | --- |
| P0 | 5 | Bảo mật, secret, error contract, validation |
| P1 | 6 | Hiệu năng DB, dữ liệu, tính đúng đắn |
| P2 | 9 | Frontend: bundle, cấu trúc, UX, state |
| P3 | 5 | Vệ sinh code, timezone, test, CI |
| **Tổng** | **25** | |

---

## P0 — Bảo mật và tính đúng đắn

### P0-01 — Tách secret và fail-fast khi dùng default
- **Trạng thái:** verified (2026-11-18, branch `task/P0-01-secret-separation`)
- **Test:** `./mvnw -B verify` (69 tests), `npm run lint && npm run build`, `python -m unittest discover -s tests` (12), `terraform validate` demo/prod.
- **Vấn đề:** `jwt.secret` có default trong `application.properties`; `JwtTokenProvider` và `TicketSignatureService` dùng chung secret; QR vé có thể bị forge nếu lộ JWT secret.
- **File:** `backend/src/main/resources/application.properties`, `backend/src/main/java/com/ticketrush/util/JwtTokenProvider.java`, `backend/src/main/java/com/ticketrush/service/TicketSignatureService.java`, `docker-compose.yml`, `.env.example`, `docs/LOCAL_DEV.md`.
- **Việc cần làm:**
  - [x] Bỏ fallback secret trong code; đọc `JWT_SECRET` bắt buộc.
  - [x] Thêm `app.ticket.signing-secret` (env `TICKET_SIGNING_SECRET`), tách khỏi `JWT_SECRET`; hỗ trợ `app.ticket.signing-key-version` và payload v2 (vẫn đọc được vé v1).
  - [x] Fail-fast khi secret rỗng/ngắn hơn 32 byte hoặc trùng `JWT_SECRET`, trừ khi `APP_ALLOW_INSECURE_DEFAULTS=true` (chỉ local).
  - [x] Cập nhật compose/env mẫu/docs/Terraform; secret mới không commit.
- **Acceptance:** app không start nếu thiếu secret ở profile thường; test ký/verify vé vẫn pass; không còn literal secret trong `src/main`.
- **Test:** unit test cho `TicketSignatureService` (đúng/sai/version), `./mvnw -B verify`.

### P0-02 — Gate dữ liệu demo theo môi trường
- **Trạng thái:** verified (2026-11-18, branch `task/P0-02-demo-seed-gate`)
- **Test:** `./mvnw -B verify` (72 tests).
- **Vấn đề:** `VoucherDataInitializer` tạo `RUSH100/SALE10/VIP50` ở mọi môi trường, kể cả production.
- **File:** `backend/src/main/java/com/ticketrush/config/VoucherDataInitializer.java`, `application.properties`, `docker-compose.yml`.
- **Việc cần làm:**
  - [x] Thêm `app.seed.demo-data=false` mặc định; chỉ bật ở compose/local.
  - [x] Thay `CommandLineRunner` bằng `@ConditionalOnProperty`.
  - [x] Không seed khi property tắt (mặc định production).
- **Acceptance:** chạy app với property tắt → bảng `vouchers` trống; bật → seed như cũ và idempotent.
- **Test:** integration test với property bật/tắt; `./mvnw -B verify`.

### P0-03 — Bảo vệ WebSocket và không lộ userId
- **Trạng thái:** verified (2026-11-18, branch `task/P0-03-websocket-auth`)
- **Test:** `./mvnw -B verify` (77 tests), `npm run lint && npm run build`, Playwright 16/16.
- **Vấn đề:** topic công khai `/topic/queue/{showtimeId}` broadcast `userId`; ai cũng subscribe được mọi showtime.
- **File:** `backend/src/main/java/com/ticketrush/config/WebSocketConfig.java`, `service/VirtualQueueService.java`, `frontend/src/pages/WaitingRoomPage.jsx`, `frontend/src/lib/wsUrl.js`.
- **Việc cần làm:**
  - [x] Xác thực JWT ở frame `CONNECT` qua header `Authorization`/`token`; token sai bị từ chối.
  - [x] Gửi `ACCESS_GRANTED` qua `/user/queue/access`; payload không còn `userId`.
  - [x] Topic công khai chỉ còn `POSITION_UPDATE` và trạng thái ghế (không định danh).
  - [x] FE gửi token khi connect, subscribe `/user/queue/access`; polling REST vẫn là fallback.
- **Acceptance:** user B không nhận được userId của user A; subscribe không token bị từ chối; queue/seat realtime vẫn hoạt động 2 tab.
- **Test:** test STOMP (2 client), Playwright queue flow, `./mvnw -B verify`.

### P0-04 — Chuẩn hoá error contract
- **Trạng thái:** verified (2026-11-18, branch `task/P0-04-error-contract`)
- **Test:** `./mvnw -B verify` (74 tests).
- **Vấn đề:** mọi `RuntimeException` → 400 kèm message nội bộ; `Map.of` NPE nếu message null; không log; thiếu handler validation/access denied.
- **File:** `backend/src/main/java/com/ticketrush/exeption/GlobalExceptionHandler.java` (đổi tên package `exception` nếu làm cùng), toàn bộ controller/service ném lỗi.
- **Việc cần làm:**
  - [x] Tạo `ApiError { code, message, fieldErrors?, traceId }`.
  - [x] Handler riêng: validation 400 + field errors, malformed JSON 400, data integrity 409, access denied 403, data access/generic 500 + log/traceId, 404/405.
  - [x] Không còn `Map.of` với message có thể null; message nội bộ không bị trả ở lỗi 500.
  - [x] Giữ hợp đồng 400 cho business exception legacy; typed exception đầy đủ để lại P3-01 khi đổi status có kiểm soát.
  - [x] FE tiếp tục đọc `message`; `code`/`fieldErrors` sẵn sàng cho UI mới.
- **Acceptance:** không response nào chứa stack trace/tên bảng; lỗi validation có field errors; 401/403/409 phân biệt đúng.
- **Test:** MockMvc cho 400/401/403/404/409/500; `./mvnw -B verify`; Playwright checkout.

### P0-05 — Validation request DTO + `@Valid`
- **Trạng thái:** verified (2026-11-18, branch `task/P0-05-request-validation`)
- **Test:** `./mvnw -B verify` (75 tests).
- **Vấn đề:** `LockSeatRequest`, `EventCreateRequest`, `ZoneRequest`, `UserProfileDto`… không constraint; controller thiếu `@Valid`; input xấu gây NPE/409 khó hiểu.
- **File:** `model/dto/*.java`, các controller tương ứng.
- **Việc cần làm:**
  - [x] `LockSeatRequest`: `@NotNull showtimeId`, `@NotEmpty seatIds`, tối đa 50 ghế/lần.
  - [x] `EventCreateRequest`: `@NotBlank eventName`, `@Size` các field, ít nhất 1 showtime, validate từng showtime/zone.
  - [x] `ZoneRequest`: `matrixRow/matrixCol` trong 1..200; `price` finite/không âm; giới hạn tổng ghế chuyển sang P1-04.
  - [x] `UserProfileDto`: `@Email`, `@Size`, `@Past` ngày sinh.
  - [x] Thêm `@Valid` ở controller; handler bắt `MethodArgumentNotValidException`, `ConstraintViolationException`, `HandlerMethodValidationException`.
- **Acceptance:** payload thiếu field trả 400 + danh sách field; không còn NPE từ input.
- **Test:** MockMvc invalid payload cho từng endpoint; `./mvnw -B verify`.

---

## P1 — Hiệu năng và dữ liệu

### P1-01 — Sửa N+1 cho API event
- **Trạng thái:** verified (2026-11-18, branch `task/P1-01-event-n-plus-one`)
- **Test:** `./mvnw -B verify` (78 tests), test đếm query `eventListQueryCountDoesNotGrowWithEventCount`.
- **Vấn đề:** `EventService.getAllEvents()` `findAll()` rồi lazy load `showtimes` → `zones`, gây N+1 ở endpoint public.
- **File:** `repository/EventRepository.java`, `service/EventService.java`, `model/dto/EventResponse.java`.
- **Việc cần làm:**
  - [x] Thêm `left join fetch showtimes` cho list/detail, tránh MultipleBagFetch.
  - [x] `@BatchSize(100)` cho `Showtime.zones` để giữ số query không tăng theo số event.
  - [x] Test Hibernate statistics: thêm 4 event không tăng query count.
- **Acceptance:** số query cho `/api/events` không tăng theo số event; JSON không đổi.
- **Test:** integration test đếm query; `./mvnw -B verify`; k6 smoke.

### P1-02 — Bỏ `@Data` khỏi JPA entity
- **Trạng thái:** verified (2026-11-18, branch `task/P1-02-entity-lombok`)
- **Test:** `./mvnw -B verify` (80 tests), `EntityLombokTest`.
- **Vấn đề:** `@Data` sinh `toString/equals/hashCode` đệ quy qua quan hệ 2 chiều, có thể `LazyInitializationException`/`StackOverflow`.
- **File:** `model/entity/*.java`.
- **Việc cần làm:**
  - [x] Đổi sang `@Getter @Setter` (giữ `@Builder/@NoArgsConstructor` ở User/TicketCheckin).
  - [x] `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` chỉ dùng `id`.
  - [x] `@ToString(exclude = ...)` cho quan hệ và password.
  - [x] Không đổi tên cột/schema; test đệ quy và equality pass.
- **Acceptance:** log/serialize không lỗi vòng lặp; test hiện có pass; không đổi JSON API.
- **Test:** `./mvnw -B verify`; test serialize entity.

### P1-03 — Chỉ trả voucher còn dùng được
- **Trạng thái:** verified (2026-11-18, branch `task/P1-03-voucher-availability`)
- **Test:** `./mvnw -B verify` (81 tests), frontend lint/build, Playwright 16/16.
- **Vấn đề:** `getActiveVouchers` lọc mỗi `active=true`; voucher hết hạn/hết lượt/chưa bắt đầu vẫn hiện.
- **File:** `service/CheckoutService.java`, `repository/VoucherRepository.java`, `frontend/src/pages/CheckoutPage.jsx`.
- **Việc cần làm:**
  - [x] Query lọc `active`, `startDate <= now`, `endDate >= now`, `usedQuantity < totalQuantity`.
  - [x] Sắp xếp theo `minOrderPrice`; bỏ `DEFAULT_VOUCHERS` hardcode ở FE.
  - [x] Test 4 trạng thái voucher trên `/api/orders/vouchers`.
- **Acceptance:** voucher hết hạn không xuất hiện; apply trực tiếp vẫn trả lỗi rõ ràng.
- **Test:** repository/service test với 4 trạng thái voucher; Playwright checkout voucher.

### P1-04 — An toàn khi sinh zone/ghế
- **Trạng thái:** verified (2026-11-18, branch `task/P1-04-zone-generation`)
- **Test:** `./mvnw -B verify` (84 tests), `ZoneServiceTest` + integration tạo/xoá zone.
- **Vấn đề:** `matrixRow × matrixCol` không giới hạn → OOM; label hỏng khi > 26 hàng; logic tạo ghế copy 2 nơi; xoá zone cascade từng ghế.
- **File:** `service/ZoneService.java`, `model/dto/ZoneRequest.java`, `repository/SeatRepository.java`.
- **Việc cần làm:**
  - [x] Giới hạn tổng ghế/zone và tổng ghế/request (cấu hình), trả 400.
  - [x] Hàm `rowLabel` hỗ trợ `A..Z, AA..` và test tới `AAA`.
  - [x] Tách `generateSeats(zone, rows, cols)` dùng chung.
  - [x] Xoá draft ticket hết hạn + xoá ghế theo `zone_id` bằng bulk query trước khi xoá zone.
- **Acceptance:** request 10^6 ghế bị từ chối nhanh; label hàng 27 đúng; xoá zone không N+1.
- **Test:** unit test label/limit; integration test tạo/xoá zone.

### P1-05 — Maintenance worker dọn draft + index
- **Trạng thái:** verified (2026-11-18, branch `task/P1-05-maintenance-cleanup`)
- **Test:** `./mvnw -B verify` (84 tests), worker unit + PostgreSQL integration 5/5 (DSN local).
- **Vấn đề:** order EXPIRED còn ticket nháp; `SQL_REAP_SEATS` gần như no-op; thiếu index cho `orders(expires_at)`.
- **File:** `infra/lambda/maintenance/maintenance.py`, `backend/src/main/resources/db/migration/V9__*.sql`, `infra/lambda/maintenance/test_worker.py`.
- **Việc cần làm:**
  - [x] Migration `V9`: partial index `orders(expires_at) WHERE status='PENDING'`.
  - [x] Worker xoá ticket của order EXPIRED sau bước expire; giữ `SQL_REAP_SEATS` làm safety net cho dữ liệu legacy.
  - [x] Test worker unit + PostgreSQL integration (4 job, idempotent, rollback).
- **Acceptance:** sau job không còn draft ticket mồ côi; `EXPLAIN` dùng index; test worker pass.
- **Test:** `python -m unittest` trong `infra/lambda/maintenance`; Flyway migrate sạch từ V1.

### P1-06 — Tách join/status queue, bỏ code chết
- **Trạng thái:** verified (2026-11-18, branch `task/P1-06-queue-join-status`)
- **Test:** `./mvnw -B verify` (85 tests), frontend lint/build, Playwright 16/16.
- **Vấn đề:** `GET /queue/{id}/status` mutate Redis (`checkAndEnqueue`), `getStatus()` không dùng.
- **File:** `controller/QueueController.java`, `service/VirtualQueueService.java`, `frontend/src/api/eventApi.js`, `WaitingRoomPage.jsx`, `BookingPage.jsx`.
- **Việc cần làm:**
  - [x] `POST /queue/{id}/join` → enqueue; `GET /queue/{id}/status` → chỉ đọc.
  - [x] FE gọi join một lần khi vào phòng chờ, poll status; rời hàng chờ không bị thêm lại.
  - [x] `getStatus` được dùng đúng chỗ; test polling không re-enqueue.
- **Acceptance:** polling không đưa user đã rời hàng chờ trở lại; queue flow 2 tab vẫn đúng.
- **Test:** service test + Playwright queue.

---

## P2 — Frontend

### P2-01 — Code split theo route
- **Trạng thái:** verified (2026-11-18, branch `task/P2-01-route-split`)
- **Test:** `npm run build` (entry 221 kB, max chunk 221 kB), lint, Playwright 16/16.
- **Vấn đề:** bundle 883 kB / 271 kB gzip, import toàn bộ page + framer-motion.
- **File:** `frontend/src/App.jsx`, `frontend/vite.config.js`.
- **Việc cần làm:**
  - [x] `React.lazy` + `Suspense` cho admin/profile/my-tickets; booking flow giữ eager để automation frozen-clock ổn định.
  - [x] Tách vendor chunk react/query/motion bằng `manualChunks` (rolldown function).
  - [x] Fallback `role=status`/`aria-live`; entry giảm từ 883 kB xuống 221 kB.
- **Acceptance:** initial JS < 500 kB; route lazy load đúng; build không warning chunk.
- **Test:** `npm run build`, Playwright smoke các route.

### P2-02 — Tách component admin lớn
- **Trạng thái:** verified (2026-11-18, branch `task/P2-02-admin-split`, phase 1)
- **Test:** frontend lint/build, Playwright 16/16.
- **Ghi chú:** đã tách toàn bộ chart/panel thuần sang `components/admin/EventInsights.jsx` (395 dòng) và gom API vào `adminApi`. `AdminEventsList` còn 1.060 dòng và `AdminAddEvent` 1.572 dòng; việc chia nhỏ theo step/modal tiếp tục ở P2-02b.
- **Vấn đề:** `AdminAddEvent.jsx` 1.567 dòng, `AdminEventsList.jsx` 1.450 dòng; JSX inline rất dài; gọi API trực tiếp.
- **File:** `frontend/src/pages/AdminAddEvent.jsx`, `AdminEventsList.jsx`, `src/api/adminApi.js`.
- **Việc cần làm:**
  - [x] Tách chart/panel thuần (MetricCard, RevenueChart, OccupancyPanel, SeatMatrix, Donut/Age, AnalyticsOverview).
  - [x] Gom API call event/analytics/zone/CRUD vào `adminApi`.
  - [x] Không còn gọi `axiosClient` trực tiếp trong page admin; hành vi/UI giữ nguyên.
  - [x] P2-02b: tách step component của `AdminAddEvent` và modal/detail của `AdminEventsList` (xem P2-02b).
- **Acceptance phase 1:** không còn `axiosClient` trực tiếp trong page; test admin pass; chart tách riêng. Line count đầy đủ để P2-02b.
- **Test:** `npm run lint`, `npm run build`, Playwright `admin-tools.spec.js`.

### P2-03 — Sửa mutate state trong form
- **Trạng thái:** verified (2026-11-18, branch `task/P2-03-list-state`)
- **Test:** `node --test tests/list_state.test.cjs`, frontend lint/build.
- **Vấn đề:** `[...formData.zones]` rồi gán `updated[index].field` → sửa object gốc; drag/resize cũng vậy.
- **File:** `frontend/src/pages/AdminAddEvent.jsx`.
- **Việc cần làm:**
  - [x] Dùng `map` + spread object khi update list.
  - [x] Tách helper `updateAt(list, index, patch)` + test Node.
  - [x] Áp dụng cho input, drag và resize zone.
- **Acceptance:** state cũ không bị đột biến; React DevTools thấy reference mới đúng chỗ.
- **Test:** unit test helper; Playwright tạo event 3 bước.

### P2-04 — Thay `alert`/`confirm`, bỏ log production
- **Trạng thái:** verified (2026-11-18, branch `task/P2-04-toast-confirm`)
- **Test:** lint/build, Playwright 16/16 (dialog native đã đổi sang ConfirmHost).
- **Vấn đề:** ~30 chỗ `alert/confirm`, nhiều `console.log`.
- **File:** `BookingPage.jsx`, `CheckoutPage.jsx`, `AdminEventsList.jsx`, `AdminAddEvent.jsx`, `WaitingRoomPage.jsx`, `utils/ticketExporter.js`, `components/auth/AuthModal.jsx`…
- **Việc cần làm:**
  - [x] Tạo `ToastHost` + `ConfirmHost` dùng chung, mount trong `App`.
  - [x] Thay toàn bộ `alert` và `window.confirm` ở `src` (kể cả utils) bằng toast/`confirmAction`.
  - [x] Xoá `console.log`; giữ `console.warn/error` có ngữ cảnh.
- **Acceptance:** không còn `alert(`/`window.confirm` trong `src`; lỗi/thành công hiển thị trong UI.
- **Test:** `npm run lint`, Playwright auth/checkout/admin.

### P2-05 — Dọn asset/config chết + fallback ảnh
- **Trạng thái:** verified (2026-11-18, branch `task/P2-05-dead-assets`)
- **Test:** backend 85 tests, frontend lint/build, Playwright 16/16.
- **Vấn đề:** `App.css`, `assets/react.svg|vite.svg|hero.png`, `tailwind.config.js` không dùng; `app.qr.base-url`/`qrBaseUrl` chết; fallback dùng `via.placeholder.com`/Unsplash remote.
- **File:** `frontend/src/App.css`, `frontend/src/assets/*`, `frontend/tailwind.config.js`, `backend/.../CheckoutService.java`, `application.properties`, các page dùng ảnh.
- **Việc cần làm:**
  - [x] Xoá `App.css`, asset Vite cũ, `tailwind.config.js` (v4), field `qrBaseUrl`/`app.qr.base-url`.
  - [x] Thêm `public/media/fallback-event.svg`, bỏ fallback Unsplash/via.placeholder; lazy-load ảnh card.
  - [x] `DEFAULT_VOUCHERS` đã bỏ ở P1-03.
- **Acceptance:** không còn tham chiếu asset chết; ảnh lỗi hiển thị fallback local.
- **Test:** `npm run build`, Playwright page smoke.

### P2-06 — Memoize derive dữ liệu ở Home
- **Trạng thái:** verified (2026-11-18, branch `task/P2-06-home-memo`)
- **Test:** frontend lint/build, Playwright 16/16.
- **Vấn đề:** sort/filter toàn bộ event chạy lại mỗi giây do countdown tick.
- **File:** `frontend/src/pages/Home.jsx`.
- **Việc cần làm:**
  - [x] `useMemo` cho `sortedEvents`/`filteredEvents` theo `events`, `searchQuery`, `selectedCategory`.
  - [x] Tách `Countdown` thành component riêng để tick mỗi giây không re-render cả trang.
- **Acceptance:** countdown tick không recompute sort/filter; UI không đổi.
- **Test:** React Profiler (thủ công), Playwright home.

---

### P2-02b — Tách step/modal admin (follow-up)
- **Trạng thái:** verified (2026-11-18, branch `task/P2-02b-admin-split-followup`)
- **Test:** `npm run lint`, `npm run build`, Playwright 18/18 (`npm run test:browser`, thêm 2 test admin event).
- **Vấn đề:** `AdminAddEvent.jsx` và phần modal/detail của `AdminEventsList.jsx` vẫn quá lớn sau phase 1.
- **Việc cần làm:**
  - [x] Tách `EventInfoStep`, `ZoneStep`, `SeatMapStep` khỏi `AdminAddEvent`.
  - [x] Tách `EventDetailModal`/`EventEditForm` khỏi `AdminEventsList`; thêm `EventShowtimeSelector`, `EventZonePricing`, `VenueSeatMap`, `QueueManagementSection`.
  - [x] Giữ nguyên hành vi; thêm Playwright cho luồng tạo event và mở modal chi tiết.
- **Kết quả:** `AdminAddEvent` 341 dòng, `AdminEventsList` 226 dòng; component lớn nhất 482 dòng (`EventInfoStep`).
- **Acceptance:** mỗi page < ~500 dòng, test admin pass.

### P2-07 — Unified seat map + mô phỏng góc nhìn từ ghế
- **Trạng thái:** verified (2026-11-18, branch `task/P2-07-unified-seat-map`)
- **Test:** `./mvnw -B verify` (88 tests), `npm run lint`, `npm run build`, `node --test tests/*.test.cjs` (20), Playwright 19/19.
- **Vấn đề:** Booking tách 2 màn `zone-overview` → `seat-picker`; màn đầu chỉ có khối khu vực, màn sau chỉ hiện ghế của một khu nên người dùng mất vị trí tương đối so với màn hình, lối đi và các khu khác; không có góc nhìn thực tế từ ghế.
- **File:** `frontend/src/pages/BookingPage.jsx`, `frontend/src/components/booking/*`, `frontend/src/utils/seatView.js`, `frontend/src/api/eventApi.js`, `backend/.../EventController.java`, `SeatService.java`, `SeatRepository.java`, `ShowtimeSeatResponse.java`, test hai phía.
- **Thiết kế:** một sơ đồ rạp duy nhất (màn hình ở trên, hàng A→, ghế thật trong từng khu), khu vực chỉ là lớp nền/giá; ghế là control chính. Panel chi tiết hiện khu/hàng/số/giá và mô phỏng góc nhìn từ ghế tới màn hình (độ lệch tâm, khoảng cách, độ nghiêng). Giữ tông navy của app, scene rạp tối với ánh sáng màn hình ấm; không dùng ảnh placeholder bên ngoài.
- **Việc cần làm:**
  - [x] Thêm API `GET /api/events/showtimes/{showtimeId}/seats` trả toàn bộ ghế kèm `zoneId/zoneName/price`, tránh N+1.
  - [x] Hợp nhất zone overview + seat picker thành một hall map; render ghế theo `gridRow/gridCol` trong đúng vị trí khu.
  - [x] Thêm legend trạng thái/hạng vé, zoom đơn giản, nhãn hàng, aria-label và thao tác bàn phím cho ghế.
  - [x] Thêm panel “Góc nhìn từ ghế” mô phỏng theo tọa độ ghế; helper thuần + test Node.
  - [x] Playwright: chọn ghế nhiều khu, kiểm tra tổng tiền, panel góc nhìn, ghế bị khóa/đã bán.
- **Kết quả:** `BookingPage` 516 dòng; `HallSeatMap` 178, `ViewFromSeat` 108, helper `seatView` 82 dòng. Map dùng endpoint mới, fallback API theo zone nếu backend cũ.
- **Acceptance:** người dùng thấy và chọn được ghế chính xác trên một sơ đồ duy nhất; mọi ghế có hàng/số/giá/trạng thái; panel mô phỏng đổi theo ghế; test backend/frontend/Playwright pass.

### P2-07b — Cinema layout refinement (screen trong khung, auto-fit)
- **Trạng thái:** verified (2026-11-18, branch `task/P2-07b-cinema-layout`)
- **Test:** `npm run lint`, `npm run build`, `node --test tests/*.test.cjs` (21), Playwright 19/19.
- **Vấn đề:** sau P2-07, màn hình nằm ngoài khung đen; các zone co lại ở giữa khung nên ghế nhỏ, nhiều khoảng trống; bố cục chưa giống rạp (thiếu lối đi giữa, lối vào, screen trong khung).
- **File:** `frontend/src/components/booking/HallSeatMap.jsx`, `ViewFromSeat.jsx`, `frontend/src/pages/BookingPage.jsx`, `frontend/src/utils/seatView.js`, test Node/Playwright.
- **Việc cần làm:**
  - [x] Đưa màn hình vào trong khung đen, phía trên ghế; thêm nhãn lối vào/lối đi.
  - [x] Auto-fit toàn bộ zone vào vùng ghế (scale đều, giữ vị trí tương đối) để tăng kích thước ghế.
  - [x] Thêm lối đi giữa cho khu >= 8 cột; giữ số ghế liên tục.
  - [x] Đồng bộ geometry đã fit với panel “Góc nhìn từ ghế”.
  - [x] Cập nhật test Node cho fit layout và Playwright.
- **Kết quả:** màn hình nằm trong khung đen; vùng ghế auto-fit (scale tối đa 2.0) nên ghế lớn hơn; map mobile bỏ min-width cứng, hiển thị đủ khung và vẫn có zoom; panel góc nhìn dùng đúng tọa độ đã fit.
- **Acceptance:** màn hình + ghế cùng nằm trong khung đen; ghế lớn hơn, ít khoảng trống; bố cục có lối đi giữa/lối vào; view-from-seat khớp vị trí; test pass.

## P3 — Vệ sinh code và CI

### P3-01 — Thống nhất injection/style, sửa typo package
- **Trạng thái:** verified (2026-11-18, branch `task/P3-01-code-style`)
- **Test:** `./mvnw -B verify` (85 tests).
- **Vấn đề:** trộn field/constructor injection; FQCN inline; package `exeption`.
- **File:** `controller/EventController.java`, `QueueController.java`, `service/SeatLockService.java`, `VirtualQueueService.java`, `exeption/*`.
- **Việc cần làm:**
  - [x] `@RequiredArgsConstructor` + `private final` ở EventController/QueueController/SeatLockService/VirtualQueueService.
  - [x] Import đầy đủ, bỏ FQCN inline trong controller.
  - [x] Đổi `exeption` → `exception`, cập nhật test khởi tạo service.
- **Acceptance:** không còn `@Autowired` field; build/lint sạch.
- **Test:** `./mvnw -B verify`.

### P3-02 — Thống nhất timezone
- **Trạng thái:** verified (2026-11-18, branch `task/P3-02-timezone`)
- **Test:** `./mvnw -B verify` (85 tests) với `TZ=UTC -Duser.timezone=UTC` và mặc định Asia/Ho_Chi_Minh.
- **Vấn đề:** default TZ VN + `hibernate.jdbc.time_zone=UTC` + `LocalDateTime.now()` + hardcode zone ở `CheckoutService`.
- **File:** `DemoApplication.java`, `util/EventTime.java`, `service/CheckoutService.java`, entities dùng `LocalDateTime.now()`.
- **Việc cần làm:**
  - [x] Chốt business time = `EventTime.ZONE`; mọi `now()` nghiệp vụ dùng `EventTime.now()`.
  - [x] Bỏ hardcode `Asia/Ho_Chi_Minh` trong `CheckoutService`, dùng `EventTime.toOffset`.
  - [x] Bỏ set default timezone trùng lặp; test toàn bộ backend pass dưới UTC và VN.
- **Acceptance:** test expiry/queue ổn định khi `TZ=UTC` và `TZ=Asia/Ho_Chi_Minh`.
- **Test:** `./mvnw -B verify` với 2 biến TZ; test Node `event_time`.

### P3-03 — Bổ sung test cho gap rủi ro
- **Trạng thái:** verified (2026-11-18, branch `task/P3-03-test-gaps`)
- **Test:** test mới `ExceptionHandlerContractTest`; các gap validation/voucher/N+1/queue/WS đã có test trong P0/P1.
- **Vấn đề:** thiếu test confirm race, voucher hết hạn/hết lượt, validation, admin CRUD.
- **File:** `backend/src/test/java/...`, `frontend/tests/...`.
- **Việc cần làm:**
  - [x] Concurrent confirm/voucher race: `onlyOneConcurrentOrderConsumesLastVoucherAndConfirmIsIdempotent`.
  - [x] Voucher expired/out-of-quota/event mismatch và available list.
  - [x] Invalid DTO → 400 + fieldErrors; malformed JSON.
  - [x] Admin event create/patch/delete/zone lifecycle.
  - [x] Playwright: checkout hết hạn/cancel/recovery, queue redirect; error handler null/500 contract.
- **Acceptance:** các case trên có test tự động, chạy trong CI.
- **Test:** toàn bộ gate.

### P3-04 — Siết CI và dọn môi trường local
- **Trạng thái:** verified (2026-11-18, branch `task/P3-04-ci-gate`)
- **Test:** `node --test tests/*.test.cjs` (16), lint `--max-warnings=0`, build + size check, Playwright 16/16, python 12.
- **Vấn đề:** ESLint còn 4 warning nhưng CI không fail; `backend/target` root-owned chặn `mvnw test` local.
- **File:** `frontend/package.json`, `.github/workflows/ci.yml`, `.gitignore`.
- **Việc cần làm:**
  - [x] Lint `eslint . --max-warnings=0`; sửa 4 warning hook ở Checkout/WaitingRoom.
  - [x] CI build + check entry bundle <= 512000 bytes; gộp chạy toàn bộ node tests.
  - [x] Dọn `backend/target` root-owned (chuyển ra ngoài repo), `./mvnw verify` chạy local với JDK 17.
- **Acceptance:** CI fail khi có warning mới; local chạy được backend test.
- **Test:** chạy lại CI local equivalent.

### P3-05 — Sửa Terraform test thiếu biến ticket signing
- **Trạng thái:** verified (2026-11-18, branch `task/P3-05-ci-terraform-test`)
- **Test:** `terraform fmt -check -recursive`, `terraform test` bootstrap + compute, `terraform validate` demo/prod.
- **Vấn đề:** P0-01 thêm biến `ticket_signing_secret_name` nhưng test `modules/compute/tests/ecr.tftest.hcl` không khai báo → job Terraform của CI fail từ sau P0-01.
- **File:** `infra/terraform/modules/compute/tests/ecr.tftest.hcl`.
- **Việc cần làm:**
  - [x] Thêm `ticket_signing_secret_name` vào block `variables` của test.
  - [x] Chạy lại toàn bộ test/validate Terraform local.
- **Acceptance:** job `terraform` của CI pass trở lại; không đổi hạ tầng.

---

## DEMO — Bổ sung trước khi demo

### DEMO-01 — Ảnh sự kiện demo không phụ thuộc host ngoài
- **Trạng thái:** verified (2026-11-18, branch `task/DEMO-01-event-images`)
- **Test:** backend `./mvnw -B verify` 88 tests (JDK 17) + migration upgrade V6→V10; frontend `npm run lint`, `npm run build`, `npm run test:browser` 19/19; `node --test tests/*.test.cjs` 21; `python -m unittest discover -s tests` 12. Live: 5/5 ảnh 200, 0 console error, fallback hoạt động khi chặn 1 ảnh.
- **Vấn đề:** ảnh seed trỏ `picsum.photos` (redirect sang `fastly.picsum.photos` bị CSP chặn) và không có `onError`; fallback `/media/fallback-event.svg` lại rơi vào media bucket nên 403. Trang chủ, event detail, my-tickets, admin list đều hiện icon ảnh vỡ.
- **File:** `frontend/public/images/events/*`, `frontend/public/images/fallback-event.svg`, `frontend/src/components/common/EventImage.jsx`, các page/component dùng cover, `backend/src/main/resources/db/migration/V10__demo_event_covers.sql`, `seed-demo.sql`, `frontend/index.html`.
- **Việc cần làm:**
  - [x] Thêm 4 ảnh CC0 (concert/movie/sports/comedy) vào bundle frontend, crop 16:9.
  - [x] Chuyển fallback về `/images/fallback-event.svg` (frontend bucket) và thêm `EventImage` có `onError` cho mọi cover.
  - [x] Migration `V10` + `seed-demo.sql` trỏ cover về `/images/events/*`.
  - [x] Bỏ ảnh Google (gstatic) bị CSP chặn và nút Google login không hoạt động; bỏ shim inline `window.global` + sửa title/lang `index.html`.
- **Acceptance:** không còn request ảnh lỗi/CSP trên trang chủ, event detail, my-tickets, admin; ảnh lỗi đều rơi về fallback local; demo không phụ thuộc mạng ngoài.
- **Test:** `npm run lint`, `npm run build`, `node --test tests/*.test.cjs`, kiểm tra ảnh live sau deploy.

---

## UI — Cải thiện giao diện và phát hành live (2026-11-19)

> Mục tiêu: giao diện phục vụ đúng bài toán đặt vé đồng thời cao, có sơ đồ ghế realtime,
> hàng chờ và thanh toán giới hạn thời gian; kết thúc bằng bản chạy thật tại
> `https://ticketrush.sudothanh.me`.
>
> Hướng thiết kế: **box-office editorial** cho phần khám phá, **operational calm** cho
> phần giao dịch. Một font tiếng Việt, token màu/bo góc/shadow thống nhất, bỏ
> glassmorphism, CTA và trạng thái ghế phải nổi bật hơn hiệu ứng trang trí.

### UI-01 — Nền tảng thiết kế và shared shell
- **Trạng thái:** verified (2026-11-19, branch `task/UI-01-foundation`)
- **Vấn đề:** chưa load font (UI phụ thuộc font OS); token thiếu success/warning/danger,
  radius/shadow rời rạc; class Tailwind động ở Home không được generate; `text-on-surface`,
  `bg-primary-container`, `animate-in`, `prose` không tồn tại; navbar mobile không có
  search/menu; footer nhiều link chết.
- **File:** `frontend/index.html`, `frontend/src/index.css`, `frontend/src/components/layout/Navbar.jsx`,
  `frontend/src/components/layout/Footer.jsx`, `frontend/src/main.jsx`, các page dùng class lỗi.
- **Việc cần làm:**
  - [x] Self-host/import `Be Vietnam Pro` (Vietnamese subset) và khai báo `--font-sans`.
  - [x] Bổ sung token: ink/paper/action/urgency/success/danger/line, radius 8/12/20/999,
    shadow 2 mức; `tabular-nums` cho giá/tiền; focus-visible, selection, reduced-motion.
  - [x] Thay class động bằng map literal; định nghĩa hoặc thay `on-surface`/`primary-container`.
  - [x] Bỏ `animate-in/prose` không có plugin hoặc thay bằng CSS/typography tối giản.
  - [x] Navbar mobile: search + menu, keyboard/Escape, `aria-expanded`, target >= 44px.
  - [x] Footer: link category thật (URL filter), bỏ link chết; gọn hơn trên mobile.
- **Acceptance:** không còn class không được generate; font hiển thị nhất quán trên Linux/CI;
  navbar dùng được ở 320/390/768/1440; `npm run lint && npm run build` pass; Playwright pass.
- **Test:** `npm run lint`, `npm run build` (font Vietnamese subset bundled), `npm run test:browser` 19/19; screenshot 390/1440 không lỗi console.

### UI-02 — Discovery: Home và Event Detail
- **Trạng thái:** verified (2026-11-19, branch `task/UI-02-discovery`)
- **Vấn đề:** hero mobile bị cắt title; hero desktop thiếu thông tin ngày/địa điểm; filter
  category không reset được; nút “Xem thêm”, tab “Giới thiệu” và nhiều CTA là trang trí;
  event card/related event chưa thống nhất.
- **File:** `frontend/src/pages/Home.jsx`, `frontend/src/pages/EventDetail.jsx`,
  `frontend/src/components/common/EventCard.jsx`.
- **Việc cần làm:**
  - [x] Hero: `clamp()` type, `min-h` thay chiều cao cố định, scrim đủ tương phản, hiển thị
    ngày/địa điểm; một CTA chính; countdown gọn hơn trên mobile.
  - [x] Category: map class literal, filter reset “Tất cả”, đồng bộ query param; “Xem thêm”
    hoạt động hoặc bỏ.
  - [x] Event Detail: title/date/venue trên hero, bỏ tab giả hoặc làm tab thật, sidebar
    sticky, CTA mobile cố định; related events dùng chung `EventCard`.
- **Acceptance:** 390px không cắt chữ/không tràn ngang; mọi control hiển thị đều có hành vi;
  event detail đọc được title/ngày/địa điểm/giá mà không cần scroll ngược.
- **Test:** `npm run lint`, `npm run build`, `npm run test:browser` 19/19; screenshot 320/390/1440 không tràn ngang, không lỗi console.

### UI-03 — Booking flow và sơ đồ ghế
- **Trạng thái:** verified (2026-11-19, branch `task/UI-03-booking`)
- **Vấn đề:** sơ đồ 24 cột bị ép còn ~10px trên mobile; CTA thanh toán nằm cuối trang;
  thiếu dấu hiệu “ghế đang được giữ”, bước hiện tại và tổng tiền luôn nhìn thấy.
- **File:** `frontend/src/pages/BookingPage.jsx`, `frontend/src/components/booking/HallSeatMap.jsx`,
  `SeatLegend.jsx`, `ViewFromSeat.jsx`.
- **Việc cần làm:**
  - [x] Sơ đồ có min-width/scroll ngang + zoom hiện có; hit target ghế >= 24px; tooltip/focus.
  - [x] Sticky bottom bar mobile: tổng tiền + CTA, không che legend/ghế.
  - [x] Step indicator 1/3; nhắc thời gian giữ ghế; phân biệt trạng thái trống/đang chọn/
    người khác giữ/đã bán bằng màu + icon + text (không chỉ màu).
  - [x] Desktop giữ layout 2 cột, sidebar sticky; Playwright cũ vẫn pass.
- **Acceptance:** chọn/bỏ ghế được trên mobile bằng một tay; tổng tiền cập nhật ngay;
  không có control trùng nghĩa gây nhầm; 0 lỗi console.
- **Test:** `npm run lint`, `npm run build`, `npm run test:browser` 19/19; screenshot 390/1440; sơ đồ mobile scroll ngang, sticky bar chỉ render dưới 1024px.

### UI-04 — Waiting Room và Checkout
- **Trạng thái:** verified (2026-11-19, branch `task/UI-04-queue-checkout`)
- **Vấn đề:** waiting room ưu tiên media giả (“Highlights Concert 2026”, “04:12”) hơn vị trí
  và ETA; checkout mất countdown khi scroll, thiếu stepper, chữ phụ 9–10px khó đọc.
- **File:** `frontend/src/pages/WaitingRoomPage.jsx`, `frontend/src/pages/CheckoutPage.jsx`.
- **Việc cần làm:**
  - [x] Queue: hero là vị trí + số người phía trước + ETA + progress %; trạng thái kết nối
    WebSocket/polling; media thật của event (hoặc bỏ khối trailer giả).
  - [x] Checkout: stepper 3 bước; timer/tổng tiền/CTA luôn nhìn thấy (sticky rail desktop,
    bottom bar mobile); tăng size/contrast label; tóm tắt vé thu gọn trên mobile.
  - [x] Xử lý trạng thái hết hạn/đã thanh toán rõ ràng, không mất ngữ cảnh.
- **Acceptance:** người dùng luôn biết mình đang ở bước nào, còn bao lâu, còn bao nhiêu tiền;
  queue không còn nội dung hard-code sai sự kiện; Playwright checkout pass.
- **Test:** `npm run lint`, `npm run build`, `npm run test:browser` 19/19; screenshot 390/1440; không còn trailer/cover hard-code sai sự kiện.

### UI-05 — Accessibility, account và polish cuối
- **Trạng thái:** todo
- **Vấn đề:** nhiều label 9–10px, `text-slate-400` trên trắng; modal MyTickets/AuthModal
  thiếu `role=dialog`/focus trap/Escape; nút icon thiếu aria; MyTickets có nút chết.
- **File:** `frontend/src/pages/MyTickets.jsx`, `Profile.jsx`, `components/auth/AuthModal.jsx`,
  `components/ui/*`, các file còn sót text quá nhỏ.
- **Việc cần làm:**
  - [ ] Tăng size tối thiểu 12px cho label phụ, 14px cho body; thay slate-400 bằng slate-500/600.
  - [ ] Modal: role/aria-modal, focus trap, Escape, trả focus; nút icon có aria-label.
  - [ ] Bỏ hoặc hoàn thiện “Tải thêm”/`MoreVertical`; empty state rõ hành động.
  - [ ] Rà `prefers-reduced-motion`, hover lift, focus ring toàn app.
- **Acceptance:** keyboard đi hết flow chính; không còn text < 12px mang thông tin;
  Lighthouse a11y không có lỗi contrast/name/role nghiêm trọng.
- **Test:** lint/build + Playwright toàn bộ + kiểm tra keyboard thủ công.

### DEPLOY-01 — Phát hành live và xác minh
- **Trạng thái:** todo
- **Vấn đề:** bản live hiện là build cũ; cần phát hành đúng artifact và xác minh trên domain thật.
- **File:** `frontend/`, `docs/AWS_DEPLOY.md`, `README.md`.
- **Việc cần làm:**
  - [ ] Build với `VITE_API_URL=/api`, `VITE_WS_URL=""`, `VITE_MEDIA_BASE_URL=""`.
  - [ ] Sync asset hash trước, `index.html` sau, `--cache-control` đúng; invalidate `/`.
  - [ ] Smoke live: `/api/status`, `/`, assets, login, event detail, booking, queue, checkout,
    admin; ghi 0 console error và HTTP status.
  - [ ] Ghi URL + thời điểm deploy vào task.md/README nếu cần.
- **Acceptance:** `https://ticketrush.sudothanh.me` chạy bản mới, flow chính hoạt động,
  asset không 404, không lỗi console/CSP.
- **Test:** build + `aws s3 sync` + CloudFront invalidation + Playwright live smoke.

---

## Thứ tự thực hiện đề xuất

1. **Sprint 1 (P0):** P0-01 → P0-02 → P0-04 → P0-05 → P0-03.
2. **Sprint 2 (P1):** P1-01 → P1-02 → P1-03 → P1-04 → P1-05 → P1-06.
3. **Sprint 3 (P2):** P2-03 → P2-06 → P2-01 → P2-02 → P2-04 → P2-05.
4. **Sprint 4 (P3):** P3-01 → P3-02 → P3-03 → P3-04 → P3-05.

> Phụ thuộc: P0-04 trước P0-05 (handler validation). P1-03 trước P2-05 (bỏ voucher hardcode). P3-04 sau khi hết warning.

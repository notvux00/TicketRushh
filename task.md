# TicketRush — Task backlog cải thiện code

> Nguồn: review toàn bộ backend/frontend/infra ngày 2026-11-18.
> Quy trình bắt buộc: xem [AGENT.md](AGENT.md). Không sửa trực tiếp trên `main`.
> Trạng thái: `todo` · `doing` · `review` · `verified` · `merged`.

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
| P2 | 6 | Frontend: bundle, cấu trúc, UX, state |
| P3 | 4 | Vệ sinh code, timezone, test, CI |
| **Tổng** | **21** | |

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
- **Trạng thái:** todo
- **Vấn đề:** `EventService.getAllEvents()` `findAll()` rồi lazy load `showtimes` → `zones`, gây N+1 ở endpoint public.
- **File:** `repository/EventRepository.java`, `service/EventService.java`, `model/dto/EventResponse.java`.
- **Việc cần làm:**
  - [ ] Thêm query `left join fetch`/`@EntityGraph` cho list và detail (cẩn thận cartesian product).
  - [ ] Cân nhắc DTO projection cho list, không load `description`/`showtimes` nếu không cần.
  - [ ] Đo số query bằng Hibernate statistics trong test.
- **Acceptance:** số query cho `/api/events` không tăng theo số event; JSON không đổi.
- **Test:** integration test đếm query; `./mvnw -B verify`; k6 smoke.

### P1-02 — Bỏ `@Data` khỏi JPA entity
- **Trạng thái:** todo
- **Vấn đề:** `@Data` sinh `toString/equals/hashCode` đệ quy qua quan hệ 2 chiều, có thể `LazyInitializationException`/`StackOverflow`.
- **File:** `model/entity/*.java`.
- **Việc cần làm:**
  - [ ] Đổi sang `@Getter @Setter @NoArgsConstructor`.
  - [ ] `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` chỉ dùng `id`.
  - [ ] `@ToString(exclude = ...)` cho quan hệ.
  - [ ] Không đổi tên cột/schema.
- **Acceptance:** log/serialize không lỗi vòng lặp; test hiện có pass; không đổi JSON API.
- **Test:** `./mvnw -B verify`; test serialize entity.

### P1-03 — Chỉ trả voucher còn dùng được
- **Trạng thái:** todo
- **Vấn đề:** `getActiveVouchers` lọc mỗi `active=true`; voucher hết hạn/hết lượt/chưa bắt đầu vẫn hiện.
- **File:** `service/CheckoutService.java`, `repository/VoucherRepository.java`, `frontend/src/pages/CheckoutPage.jsx`.
- **Việc cần làm:**
  - [ ] Query lọc `active`, `startDate <= now`, `endDate >= now`, `usedQuantity < totalQuantity`.
  - [ ] Sắp xếp ổn định; bỏ `DEFAULT_VOUCHERS` hardcode ở FE.
  - [ ] Trả lý do không dùng được nếu cần (`disabledReason`).
- **Acceptance:** voucher hết hạn không xuất hiện; apply trực tiếp vẫn trả lỗi rõ ràng.
- **Test:** repository/service test với 4 trạng thái voucher; Playwright checkout voucher.

### P1-04 — An toàn khi sinh zone/ghế
- **Trạng thái:** todo
- **Vấn đề:** `matrixRow × matrixCol` không giới hạn → OOM; label hỏng khi > 26 hàng; logic tạo ghế copy 2 nơi; xoá zone cascade từng ghế.
- **File:** `service/ZoneService.java`, `model/dto/ZoneRequest.java`, `repository/SeatRepository.java`.
- **Việc cần làm:**
  - [ ] Giới hạn tổng ghế/zone và tổng ghế/request (cấu hình), trả 400.
  - [ ] Hàm `seatLabel(row, col)` hỗ trợ `A..Z, AA..`.
  - [ ] Tách `generateSeats(zone, request)` dùng chung.
  - [ ] Xoá ghế theo `zone_id` bằng bulk query trước khi xoá zone.
- **Acceptance:** request 10^6 ghế bị từ chối nhanh; label hàng 27 đúng; xoá zone không N+1.
- **Test:** unit test label/limit; integration test tạo/xoá zone.

### P1-05 — Maintenance worker dọn draft + index
- **Trạng thái:** todo
- **Vấn đề:** order EXPIRED còn ticket nháp; `SQL_REAP_SEATS` gần như no-op; thiếu index cho `orders(expires_at)`.
- **File:** `infra/lambda/maintenance/maintenance.py`, `backend/src/main/resources/db/migration/V9__*.sql`, `infra/lambda/maintenance/test_worker.py`.
- **Việc cần làm:**
  - [ ] Migration mới `V9`: partial index `orders(expires_at) WHERE status='PENDING'`; index hỗ trợ job nếu cần.
  - [ ] Worker: xoá ticket của order vừa EXPIRED (tôn trọng trigger), hoặc để backend job làm; bỏ/sửa `SQL_REAP_SEATS` cho khớp thực tế.
  - [ ] Test SQL trên PostgreSQL Testcontainer/local DSN.
- **Acceptance:** sau job không còn draft ticket mồ côi; `EXPLAIN` dùng index; test worker pass.
- **Test:** `python -m unittest` trong `infra/lambda/maintenance`; Flyway migrate sạch từ V1.

### P1-06 — Tách join/status queue, bỏ code chết
- **Trạng thái:** todo
- **Vấn đề:** `GET /queue/{id}/status` mutate Redis (`checkAndEnqueue`), `getStatus()` không dùng.
- **File:** `controller/QueueController.java`, `service/VirtualQueueService.java`, `frontend/src/api/eventApi.js`, `WaitingRoomPage.jsx`, `BookingPage.jsx`.
- **Việc cần làm:**
  - [ ] `POST /queue/{id}/join` → enqueue; `GET /queue/{id}/status` → chỉ đọc.
  - [ ] FE gọi join một lần khi vào phòng chờ, poll status.
  - [ ] Xoá `getStatus` hoặc dùng đúng chỗ.
- **Acceptance:** polling không đưa user đã rời hàng chờ trở lại; queue flow 2 tab vẫn đúng.
- **Test:** service test + Playwright queue.

---

## P2 — Frontend

### P2-01 — Code split theo route
- **Trạng thái:** todo
- **Vấn đề:** bundle 883 kB / 271 kB gzip, import toàn bộ page + framer-motion.
- **File:** `frontend/src/App.jsx`, `frontend/vite.config.js`.
- **Việc cần làm:**
  - [ ] `React.lazy` + `Suspense` cho route admin/booking/checkout.
  - [ ] Tách vendor chunk (react, query, motion) nếu cần.
  - [ ] Giữ fallback loading có accessibility.
- **Acceptance:** initial JS < 500 kB; route lazy load đúng; build không warning chunk.
- **Test:** `npm run build`, Playwright smoke các route.

### P2-02 — Tách component admin lớn
- **Trạng thái:** todo
- **Vấn đề:** `AdminAddEvent.jsx` 1.567 dòng, `AdminEventsList.jsx` 1.450 dòng; JSX inline rất dài; gọi API trực tiếp.
- **File:** `frontend/src/pages/AdminAddEvent.jsx`, `AdminEventsList.jsx`, `src/api/adminApi.js`.
- **Việc cần làm:**
  - [ ] Tách step components/hook (`useEventForm`, `useZoneEditor`).
  - [ ] Gom API call vào `adminApi`/`eventApi`.
  - [ ] Không đổi hành vi/UI.
- **Acceptance:** mỗi file < ~400 dòng; không còn `axiosClient` gọi trực tiếp trong page; test admin pass.
- **Test:** `npm run lint`, Playwright `admin-tools.spec.js`.

### P2-03 — Sửa mutate state trong form
- **Trạng thái:** todo
- **Vấn đề:** `[...formData.zones]` rồi gán `updated[index].field` → sửa object gốc; drag/resize cũng vậy.
- **File:** `frontend/src/pages/AdminAddEvent.jsx`.
- **Việc cần làm:**
  - [ ] Dùng `map` + spread object khi update list.
  - [ ] Tách helper `updateAt(list, index, patch)`.
  - [ ] Kiểm tra undo/back step không mất dữ liệu.
- **Acceptance:** state cũ không bị đột biến; React DevTools thấy reference mới đúng chỗ.
- **Test:** unit test helper; Playwright tạo event 3 bước.

### P2-04 — Thay `alert`/`confirm`, bỏ log production
- **Trạng thái:** todo
- **Vấn đề:** ~30 chỗ `alert/confirm`, nhiều `console.log`.
- **File:** `BookingPage.jsx`, `CheckoutPage.jsx`, `AdminEventsList.jsx`, `AdminAddEvent.jsx`, `WaitingRoomPage.jsx`, `utils/ticketExporter.js`, `components/auth/AuthModal.jsx`…
- **Việc cần làm:**
  - [ ] Tạo `ToastProvider` + `ConfirmDialog` dùng chung.
  - [ ] Thay toàn bộ `alert/confirm` ở luồng chính.
  - [ ] Xoá `console.log`; giữ `console.warn/error` có ngữ cảnh.
- **Acceptance:** không còn `alert(`/`confirm(` trong `src`; thông báo lỗi hiển thị trong UI.
- **Test:** `npm run lint`, Playwright auth/checkout/admin.

### P2-05 — Dọn asset/config chết + fallback ảnh
- **Trạng thái:** todo
- **Vấn đề:** `App.css`, `assets/react.svg|vite.svg|hero.png`, `tailwind.config.js` không dùng; `app.qr.base-url`/`qrBaseUrl` chết; fallback dùng `via.placeholder.com`/Unsplash remote.
- **File:** `frontend/src/App.css`, `frontend/src/assets/*`, `frontend/tailwind.config.js`, `backend/.../CheckoutService.java`, `application.properties`, các page dùng ảnh.
- **Việc cần làm:**
  - [ ] Xoá file/field không dùng (xác nhận bằng grep trước).
  - [ ] Thêm ảnh fallback local + `loading="lazy"`/`decoding="async"`.
  - [ ] Bỏ `DEFAULT_VOUCHERS` hardcode (liên quan P1-03).
- **Acceptance:** không còn tham chiếu asset chết; ảnh lỗi hiển thị fallback local.
- **Test:** `npm run build`, Playwright page smoke.

### P2-06 — Memoize derive dữ liệu ở Home
- **Trạng thái:** todo
- **Vấn đề:** sort/filter toàn bộ event chạy lại mỗi giây do countdown tick.
- **File:** `frontend/src/pages/Home.jsx`.
- **Việc cần làm:**
  - [ ] `useMemo` cho `sortedEvents`/`filteredEvents` theo `events`, `searchQuery`, `selectedCategory`.
  - [ ] Tách countdown thành component riêng để không re-render cả trang.
- **Acceptance:** countdown tick không recompute sort/filter; UI không đổi.
- **Test:** React Profiler (thủ công), Playwright home.

---

## P3 — Vệ sinh code và CI

### P3-01 — Thống nhất injection/style, sửa typo package
- **Trạng thái:** todo
- **Vấn đề:** trộn field/constructor injection; FQCN inline; package `exeption`.
- **File:** `controller/EventController.java`, `QueueController.java`, `service/SeatLockService.java`, `VirtualQueueService.java`, `exeption/*`.
- **Việc cần làm:**
  - [ ] `@RequiredArgsConstructor` + `private final`.
  - [ ] Import đầy đủ, bỏ FQCN inline.
  - [ ] Đổi `exeption` → `exception` (không ảnh hưởng DB) hoặc để lại nếu muốn giảm diff.
- **Acceptance:** không còn `@Autowired` field; build/lint sạch.
- **Test:** `./mvnw -B verify`.

### P3-02 — Thống nhất timezone
- **Trạng thái:** todo
- **Vấn đề:** default TZ VN + `hibernate.jdbc.time_zone=UTC` + `LocalDateTime.now()` + hardcode zone ở `CheckoutService`.
- **File:** `DemoApplication.java`, `util/EventTime.java`, `service/CheckoutService.java`, entities dùng `LocalDateTime.now()`.
- **Việc cần làm:**
  - [ ] Chốt convention: lưu UTC, convert ở DTO boundary (hoặc ngược lại) và ghi vào docs.
  - [ ] Inject `Clock`, dùng `EventTime.ZONE` thay hardcode.
  - [ ] Bỏ set default timezone trùng lặp; thêm test expiry qua timezone.
- **Acceptance:** test expiry/queue ổn định khi `TZ=UTC` và `TZ=Asia/Ho_Chi_Minh`.
- **Test:** `./mvnw -B verify` với 2 biến TZ; test Node `event_time`.

### P3-03 — Bổ sung test cho gap rủi ro
- **Trạng thái:** todo
- **Vấn đề:** thiếu test confirm race, voucher hết hạn/hết lượt, validation, admin CRUD.
- **File:** `backend/src/test/java/...`, `frontend/tests/...`.
- **Việc cần làm:**
  - [ ] Concurrent confirm cùng order → chỉ 1 COMPLETED, không âm voucher.
  - [ ] Voucher expired/out-of-quota/event mismatch.
  - [ ] Invalid DTO → 400.
  - [ ] Admin create/update/delete event cơ bản.
  - [ ] Playwright: checkout hết hạn, queue redirect.
- **Acceptance:** các case trên có test tự động, chạy trong CI.
- **Test:** toàn bộ gate.

### P3-04 — Siết CI và dọn môi trường local
- **Trạng thái:** todo
- **Vấn đề:** ESLint còn 4 warning nhưng CI không fail; `backend/target` root-owned chặn `mvnw test` local.
- **File:** `frontend/package.json`, `.github/workflows/ci.yml`, `.gitignore`.
- **Việc cần làm:**
  - [ ] Đổi lint thành `eslint . --max-warnings=0` sau khi sửa warning.
  - [ ] Thêm bước `npm run build` size check (cảnh báo > 500 kB).
  - [ ] `sudo rm -rf backend/target` (local only) và xác nhận `./mvnw test` chạy.
- **Acceptance:** CI fail khi có warning mới; local chạy được backend test.
- **Test:** chạy lại CI local equivalent.

---

## Thứ tự thực hiện đề xuất

1. **Sprint 1 (P0):** P0-01 → P0-02 → P0-04 → P0-05 → P0-03.
2. **Sprint 2 (P1):** P1-01 → P1-02 → P1-03 → P1-04 → P1-05 → P1-06.
3. **Sprint 3 (P2):** P2-03 → P2-06 → P2-01 → P2-02 → P2-04 → P2-05.
4. **Sprint 4 (P3):** P3-01 → P3-02 → P3-03 → P3-04.

> Phụ thuộc: P0-04 trước P0-05 (handler validation). P1-03 trước P2-05 (bỏ voucher hardcode). P3-04 sau khi hết warning.

# AGENT.md — Hướng dẫn thực thi task cho TicketRush

Tài liệu này là hợp đồng làm việc cho agent/người thực hiện. Mọi task trong
[task.md](task.md) phải tuân theo quy trình dưới đây.

## 0. Nguyên tắc bất biến

1. **Không làm trên `main`.** Mọi thay đổi đi qua nhánh riêng.
2. **Không tag, không merge khi test gate chưa pass.** Không có ngoại lệ "chắc là ổn".
3. **Không commit secret, `.env`, state Terraform, build artifact.**
4. **Không sửa migration đã áp dụng** (`V1`–`V8`). Thay schema = thêm `V9+`.
5. **Không đổi hành vi ngoài scope task.** Nếu phát hiện lỗi khác: ghi vào `task.md` dưới dạng task mới, không sửa lẫn.
6. **Không push remote** trừ khi người dùng yêu cầu rõ. Tag + merge local chỉ sau gate.

## 1. Bắt đầu một task

```bash
cd TicketRushh
git fetch origin
git switch main
git pull --ff-only origin main       # chỉ khi main local sạch
git switch -c task/<ID>-<slug> origin/main
```

- `<ID>` lấy đúng từ `task.md` (ví dụ `P0-01`).
- `<slug>` ngắn, không dấu: `p0-01-secret-separation`, `p1-01-event-n-plus-one`.
- Trước khi code: đọc task, đọc file liên quan, chạy test baseline để biết trạng thái đầu vào.
- Cập nhật `task.md`: `Trạng thái: doing`, thêm dòng `Branch: task/...`.

## 2. Vòng lặp thực thi

1. **Đọc & chốt acceptance criteria** trong `task.md`. Nếu mơ hồ, hỏi lại trước khi code.
2. **Viết test trước** cho hành vi mới/sửa (unit/integration/e2e tuỳ task).
3. **Code thay đổi nhỏ nhất** đáp ứng acceptance. Không refactor ngoài scope.
4. **Chạy test gate** (mục 4). Sửa đến khi xanh.
5. **Tự review diff**: `git diff origin/main...HEAD`; kiểm tra không lẫn file rác, không log debug, không secret.
6. **Cập nhật `task.md`**: trạng thái `verified`, ghi lệnh test + kết quả.
7. **Commit** theo Conventional Commits (mục 5).
8. **Tag + merge** theo mục 6 (chỉ khi được phép).

## 3. Quy ước code của repo

### Backend (Java 17 / Spring Boot 3.5)
- Constructor injection (`@RequiredArgsConstructor`, `private final`). Không thêm field `@Autowired`.
- Controller mỏng; business logic ở service. Không đặt `@Transactional` ở controller.
- Request DTO phải có validation + `@Valid` ở controller.
- Lỗi trả qua `GlobalExceptionHandler` với `{ code, message }`, không trả message nội bộ/stack/SQL.
- Không dùng `@Data` cho JPA entity đã có quan hệ 2 chiều; dùng `@Getter/@Setter`, exclude quan hệ khỏi `toString/equals`.
- Thời gian: lưu UTC, convert ở boundary bằng `EventTime`/`Clock`; không hardcode `ZoneId` rải rác.
- Query list phải tránh N+1; dùng `@EntityGraph`/fetch join hoặc projection.
- Không tạo `RuntimeException` mới cho luồng nghiệp vụ; dùng exception có ngữ nghĩa.

### Frontend (React 19 / Vite 8)
- Gọi API qua `src/api/*`, không gọi `axiosClient` trực tiếp trong page.
- Không dùng `alert`/`window.confirm` cho luồng chính; dùng Toast/ConfirmDialog dùng chung.
- Không `console.log` trong code production.
- Không mutate state trực tiếp; update list bằng `map` + spread object.
- Route nặng phải lazy-load; giữ bundle ban đầu < 500 kB.
- Ảnh có fallback local + `loading="lazy"`; không phụ thuộc placeholder service bên ngoài.
- UI mới/chỉnh lớn: đọc skill `frontend-design` trước khi thiết kế.

### Dữ liệu / Infra
- Migration mới đặt tên `V9__<mô_tả>.sql`, có rollback note trong PR/task.
- Không sửa `V1`–`V8`.
- Terraform: `terraform fmt -recursive`, `validate`; không commit `.terraform/`, `*.tfstate*`, `terraform.tfvars`.
- Lambda: cập nhật `test_worker.py` khi đổi SQL.

## 4. Test gate bắt buộc

Chạy từ thư mục gốc `TicketRushh`. Task backend chỉ cần nhóm backend; task frontend chỉ cần nhóm frontend; task infra chạy thêm nhóm tương ứng. **Task chạm cả hai phía phải chạy tất cả.**

```bash
# Backend (cần Docker cho Testcontainers, JDK 17)
(cd backend && ./mvnw -B verify)

# Frontend
(cd frontend && npm ci && npm run lint && npm run build)

# Frontend e2e (port 18088 phải trống)
(cd frontend && npx playwright install chromium && npm run test:browser)

# Test Node thuần
node --test tests/*.test.cjs

# Python (deploy + worker)
python -m unittest discover -s tests -p 'test_*.py' -v

# Terraform (nếu chạm infra)
(cd infra/terraform && terraform fmt -check -recursive)
(cd infra/terraform/envs/demo && terraform init -backend=false && terraform validate)
(cd infra/terraform/envs/prod && terraform init -backend=false && terraform validate)
```

Quy tắc:
- **Gate xanh = tất cả lệnh thuộc phạm vi task exit 0**, không có warning mới.
- Nếu môi trường không chạy được (Docker/JDK/browser), ghi rõ lý do vào task và **không được tag/merge**; chỉ được đánh dấu `review` và chờ.
- `backend/target` có thể do `root` sở hữu từ Docker build; dọn bằng `sudo rm -rf backend/target` trước khi chạy Maven.
- JDK local có thể là 25; CI dùng 17. Ưu tiên JDK 17 khi verify, hoặc ghi rõ phiên bản đã chạy.

## 5. Commit

```
<type>(<scope>): <mô tả ngắn>

- Thay đổi chính
- Test/acceptance đã chạy
Refs: task.md#<ID>
```

`type`: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `build`.
Ví dụ: `fix(checkout): tách ticket signing secret khỏi JWT`.

Không commit:
- `.env`, `frontend/.env`, `backend/.env`
- `backend/target/`, `frontend/dist/`, `infra/**/.build/`, `.terraform/`
- file test tạm, screenshot, log

## 6. Tag và merge vào `main`

Chỉ thực hiện khi:
- [ ] Acceptance criteria trong `task.md` đã đạt.
- [ ] Test gate phạm vi task pass 100%.
- [ ] `task.md` đã cập nhật `verified` + ghi chú test.
- [ ] Diff đã tự review, không có file ngoài scope.
- [ ] Người dùng đã cho phép tag/merge (nếu phiên đang chờ xác nhận).

```bash
# 1) Đồng bộ với main mới nhất và chạy lại gate nếu có conflict
git fetch origin
git merge origin/main
# ... chạy lại test gate ...

# 2) Tag annotated trên HEAD của nhánh task
git tag -a task-<ID> -m "task <ID>: <mô tả> — tests passed"

# 3) Merge vào main local (giữ lịch sử task)
git switch main
git pull --ff-only origin main
git merge --no-ff task/<ID>-<slug> -m "merge: task <ID> <mô tả>"

# 4) Xác nhận
git log --oneline --graph -5
git tag -n
```

- **Không** `git push` tag/main nếu chưa được yêu cầu.
- Nếu merge conflict phức tạp: quay lại nhánh task, resolve, chạy lại toàn bộ gate, rồi merge lại.
- Sau merge: xoá nhánh task local (`git branch -d ...`) nếu người dùng đồng ý.
- Rollback: `git revert -m 1 <merge-commit>` và tạo tag mới; không xoá tag đã công bố.

## 7. Skills — dùng khi nào

Danh sách skill hiện có trong môi trường (gọi bằng tool `skill` với đúng `id`):

| Skill | Dùng cho |
| --- | --- |
| `frontend-design` | Task P2/P3 có thay đổi UI/UX đáng kể: layout, màu, typography, component mới. Đọc trước khi thiết kế. |
| `opencode` | Khi cần sửa cấu hình OpenCode/agent/plugin, hoặc tra cứu convention của harness. |
| `report` | Khi phát hiện bug của OpenCode/harness cần báo cáo, không dùng cho bug của TicketRush. |
| `canvas-design` | Chỉ khi cần tạo poster/ảnh tĩnh; không áp dụng cho UI app. |

Quy tắc:
- Trước task UI lớn: load `frontend-design`, ghi 3–5 quyết định thiết kế vào mô tả commit/task.
- Không load skill không liên quan để tránh nhiễu context.
- Nếu skill mới xuất hiện trong phiên, ưu tiên skill khớp domain hơn hướng dẫn chung.

## 8. Định nghĩa hoàn thành (DoD)

Một task chỉ được coi là xong khi:

- [ ] Code + test nằm trên nhánh `task/<ID>-<slug>`.
- [ ] Acceptance criteria trong `task.md` được đánh dấu.
- [ ] Test gate phạm vi task pass, có log/lệnh chứng minh.
- [ ] Không có secret/artifact trong diff.
- [ ] `task.md` cập nhật `verified` (hoặc `merged` sau khi merge).
- [ ] Tag `task-<ID>` tồn tại **sau** khi gate pass.
- [ ] Merge `--no-ff` vào `main` chỉ sau khi 5 mục trên đạt.

## 9. Ưu tiên và phạm vi phiên

- Làm **một task mỗi nhánh**. Không gộp P0-01 + P0-03 vào cùng nhánh.
- Thứ tự mặc định: P0 → P1 → P2 → P3, theo dependency ghi cuối `task.md`.
- Nếu task phát sinh thay đổi schema: tạo migration mới + test nâng cấp từ DB cũ.
- Nếu phát hiện task mới: thêm vào `task.md` với ID tiếp theo, không tự mở rộng scope.

## 10. Ghi chú môi trường

- Node >= 22.12; frontend dùng Vite 8.
- Backend cần PostgreSQL 16 + Redis 7; có thể dùng `docker compose up -d postgres redis s3mock`.
- Playwright dùng port `18088`; không chạy dev server khác trên port này.
- Test worker cần `MAINTENANCE_TEST_DSN`; xem `infra/lambda/maintenance/README.md`.
- Không commit `DEPLOY_CHECKLIST.md` (đã có trong `.gitignore` cục bộ của người dùng).

# TicketRush System Documentation

Thư mục chứa toàn bộ tài liệu kiến trúc kỹ thuật, đặc tả tính năng và hướng dẫn triển khai nâng cao cho hệ thống **TicketRush**.

## Danh mục tài liệu kỹ thuật đang lên kế hoạch triển khai

1. [Khóa Ghế Nguyên Tử Với Redis Lua Script (Atomic Multi-Seat Locking Engine)](./ATOMIC_SEAT_LOCK_LUA_SPEC.md)
   * Phân tích lỗ hổng Race Condition và lãng phí Network Round-trip của vòng lặp Java hiện tại.
   * Thuật toán Redis Lua Script 2 pha (Pha 1: Verification, Pha 2: Atomic Commit).
   * Triệt tiêu 100% tình trạng "Ghế ma" (Zombie Locks) và khóa dở dang khi JVM crash.
   * Ma trận kiểm thử 100 Virtual Threads tranh chấp đồng thời và bảng so sánh Benchmark.

2. [Admin Dashboard Overview — Kết Nối Dữ Liệu Thật Toàn Hệ Thống](./ADMIN_DASHBOARD_OVERVIEW_SPEC.md)
   * Thay thế toàn bộ hardcode trong `AdminDashboard.jsx` bằng dữ liệu thật từ DB.
   * Endpoint `GET /api/admin/overview` tổng hợp KPI: doanh thu, vé bán, user đăng ký.
   * Top 3 sự kiện bán chạy nhất và bảng thống kê hiệu quả voucher.
   * Tự động làm mới dữ liệu mỗi 30 giây (refetchInterval).

3. [Web QR Scanner Check-in Cho Admin](./ADMIN_QR_CHECKIN_SCANNER_SPEC.md)
   * Giao diện soát vé QR trực tiếp từ trình duyệt, không cần app riêng.
   * Sử dụng thư viện `jsQR` + Web Camera API, hỗ trợ cả desktop và mobile.
   * Phản hồi kết quả scan < 1 giây với 3 trạng thái: HỢP LỆ / ĐÃ DÙNG / GIẢ MẠO.
   * API thống kê live số người đã vào cổng theo suất diễn.

4. [Giới Hạn Số Vé Mua Thực Tế Trong UI Đặt Chỗ](./MAX_TICKETS_ENFORCEMENT_SPEC.md)
   * Enforce `maxTicketsPerOrder` đã có trong backend lên giao diện `BookingPage.jsx`.
   * Disabled visual cho ghế khi đã chọn đủ số lượng tối đa.
   * Thay hardcode "04 Vé" trong `WaitingRoomPage.jsx` bằng giá trị động từ event data.
   * Không cần thay đổi backend — toàn bộ logic ở frontend.

5. [Admin Quản Lý Voucher Từ Giao Diện](./ADMIN_VOUCHER_MANAGEMENT_SPEC.md)
   * CRUD đầy đủ: tạo, bật/tắt, xóa voucher trực tiếp từ giao diện Admin.
   * Database Migration V5 bổ sung `expires_at`, `max_usage`, `created_at` cho bảng `vouchers`.
   * Thống kê usage: số lần dùng và tổng tiền tiết kiệm cho khách theo từng voucher.
   * Voucher bị tắt tự động ẩn khỏi danh sách hiển thị cho customer.

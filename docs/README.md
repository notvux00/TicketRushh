# TicketRush System Documentation

Thư mục chứa toàn bộ tài liệu kiến trúc kỹ thuật, đặc tả tính năng và hướng dẫn triển khai nâng cao cho hệ thống **TicketRush**.

## Danh mục tài liệu kỹ thuật đang lên kế hoạch triển khai

1. [Cơ chế Áp Dụng Voucher Giảm Giá & Sinh Lại QR Thanh Toán (Discount Voucher & Dynamic QR)](./VOUCHER_SYSTEM_SPEC.md)
   * Đặc tả quy trình: Nhập mã $\rightarrow$ Kiểm tra hợp lệ $\rightarrow$ Trừ tiền $\rightarrow$ Sinh lại mã VietQR với số tiền mới.
   * Mô hình dữ liệu bảng `vouchers` và cập nhật bảng `orders`.
   * Thuật toán tính giảm giá (Cố định & Phần trăm kèm trần tối đa).
   * Sơ đồ tuần tự Mermaid (Áp dụng mã & Hủy mã).
   * Ma trận Test Cases và Definition of Done (DoD).

2. [Cơ chế Đặt Trước Vật Phẩm Fandom & Đồ Ăn Thức Uống (Merchandise & F&B Add-On Engine)](./MERCH_ADDON_SPEC.md)
   * Đặc tả tích hợp bán kèm vật phẩm tour (Áo, Lightstick, Nước) ngay tại trang Checkout.
   * Mô hình dữ liệu bảng `merchandise` và `order_merchandise`.
   * Làn nhận đồ siêu tốc Express Pickup ngày diễn ra show.
   * Ma trận Test Cases và Definition of Done (DoD).

3. [Khóa Ghế Nguyên Tử Với Redis Lua Script (Atomic Multi-Seat Locking Engine)](./ATOMIC_SEAT_LOCK_LUA_SPEC.md)
   * Phân tích lỗ hổng Race Condition và lãng phí Network Round-trip của vòng lặp Java hiện tại.
   * Thuật toán Redis Lua Script 2 pha (Pha 1: Verification, Pha 2: Atomic Commit).
   * Triệt tiêu 100% tình trạng "Ghế ma" (Zombie Locks) và khóa dở dang khi JVM crash.
   * Ma trận kiểm thử 100 Virtual Threads tranh chấp đồng thời và bảng so sánh Benchmark.

4. [Hàng Chờ Thông Minh & Tự Động Phân Phối Vé (Smart Waitlist & Auto-Allocation Engine)](./SMART_WAITLIST_SPEC.md)
   * Cơ chế hàng chờ tự động giữ chỗ và thông báo người dùng khi có người nhả vé.
   * Kiến trúc Redis Sorted Sets (ZSET) xếp thứ tự theo mili-giây.
   * Ma trận kiểm thử và Definition of Done (DoD).

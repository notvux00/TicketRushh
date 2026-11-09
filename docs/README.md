# TicketRush System Documentation

Thư mục chứa toàn bộ tài liệu kiến trúc kỹ thuật, đặc tả tính năng và hướng dẫn triển khai nâng cao cho hệ thống **TicketRush**.

## Danh mục tài liệu kỹ thuật đang lên kế hoạch triển khai

1. [Khóa Ghế Nguyên Tử Với Redis Lua Script (Atomic Multi-Seat Locking Engine)](./ATOMIC_SEAT_LOCK_LUA_SPEC.md)
   * Phân tích lỗ hổng Race Condition và lãng phí Network Round-trip của vòng lặp Java hiện tại.
   * Thuật toán Redis Lua Script 2 pha (Pha 1: Verification, Pha 2: Atomic Commit).
   * Triệt tiêu 100% tình trạng "Ghế ma" (Zombie Locks) và khóa dở dang khi JVM crash.
   * Ma trận kiểm thử 100 Virtual Threads tranh chấp đồng thời và bảng so sánh Benchmark.

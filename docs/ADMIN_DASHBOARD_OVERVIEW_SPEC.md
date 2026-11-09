# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: ADMIN DASHBOARD OVERVIEW — KẾT NỐI DỮ LIỆU THẬT TOÀN HỆ THỐNG

* **Tên dự án:** TicketRush System
* **Phân hệ:** Admin Control Panel — System Overview
* **Trạng thái:** Architecture & Technical Specification
* **Phiên bản:** 1.0.0

---

## MỤC LỤC
1. [Tổng quan & Phân tích hiện trạng](#1-tổng-quan--phân-tích-hiện-trạng)
2. [Thiết kế API Backend](#2-thiết-kế-api-backend)
3. [Mô hình Dữ liệu & Truy vấn SQL](#3-mô-hình-dữ-liệu--truy-vấn-sql)
4. [Danh sách file cần tạo mới & chỉnh sửa](#4-danh-sách-file-cần-tạo-mới--chỉnh-sửa)
5. [Sơ đồ luồng & Thiết kế UI](#5-sơ-đồ-luồng--thiết-kế-ui)
6. [Tích hợp mã nguồn chi tiết (Implementation Blueprint)](#6-tích-hợp-mã-nguồn-chi-tiết-implementation-blueprint)
7. [Kế hoạch Kiểm thử](#7-kế-hoạch-kiểm-thử)
8. [Tiêu chuẩn hoàn thành (Definition of Done - DoD)](#8-tiêu-chuẩn-hoàn-thành-definition-of-done---dod)

---

## 1. TỔNG QUAN & PHÂN TÍCH HIỆN TRẠNG

### 1.1. Lỗ hổng trong `AdminDashboard.jsx` hiện tại

File [`frontend/src/pages/AdminDashboard.jsx`](../frontend/src/pages/AdminDashboard.jsx) hiện tại chỉ có **2 card dữ liệu cứng (hardcode)** hoàn toàn không phản ánh thực tế hệ thống:

```jsx
<p className="text-3xl font-black text-primary">$12,450</p>  // ← hardcode bằng USD?!
<p className="text-3xl font-black text-primary">1,204</p>    // ← số vé giả
```

Trong khi đó, `EventAnalyticsService.java` đã có đầy đủ logic tính toán doanh thu, ghế, gender/age distribution — nhưng chỉ phục vụ cho **từng sự kiện đơn lẻ**, không có endpoint tổng hợp toàn hệ thống.

### 1.2. Mục tiêu tính năng

Xây dựng endpoint `GET /api/admin/overview` và kết nối vào `AdminDashboard.jsx` để hiển thị:

| Mục | Dữ liệu hiển thị |
| :--- | :--- |
| **KPI Cards** | Tổng doanh thu, Tổng vé bán, Tổng user đăng ký |
| **Top Events** | 3 sự kiện bán chạy nhất (tên + doanh thu + % lấp đầy) |
| **Voucher Summary** | Các voucher đang active, số lần dùng, tổng tiết kiệm cho khách |
| **Recent Orders** | 5 đơn hàng gần nhất với trạng thái |

---

## 2. THIẾT KẾ API BACKEND

### 2.1. Endpoint mới

```
GET /api/admin/overview
Authorization: Bearer <ADMIN_TOKEN>
Response: 200 OK — AdminOverviewResponse
```

### 2.2. DTO: `AdminOverviewResponse.java`

```java
public class AdminOverviewResponse {
    // KPI
    private Double totalRevenue;         // Tổng doanh thu từ tất cả đơn COMPLETED
    private Long   totalTicketsSold;     // Tổng vé từ đơn COMPLETED
    private Long   totalUsers;           // COUNT(*) từ bảng users (role = USER)
    private Long   totalEvents;          // COUNT(*) từ bảng events
    private Long   activeVouchers;       // Voucher đang active = true

    // Top 3 sự kiện bán chạy nhất
    private List<TopEventSummary> topEvents;

    // Voucher usage summary
    private List<VoucherUsageSummary> voucherSummary;

    // 5 đơn hàng gần nhất
    private List<RecentOrderSummary> recentOrders;

    // --- Nested DTOs ---
    @Data @AllArgsConstructor
    public static class TopEventSummary {
        private String eventName;
        private Double revenue;
        private Long   ticketsSold;
        private Long   totalSeats;
        private Double occupancyRate;
        private String coverImage;
    }

    @Data @AllArgsConstructor
    public static class VoucherUsageSummary {
        private String code;
        private String discountType;    // "FIXED" | "PERCENT"
        private Double discountValue;
        private Long   usageCount;      // Số đơn đã dùng voucher này
        private Double totalSaved;      // Tổng tiền đã giảm cho khách
        private Boolean active;
    }

    @Data @AllArgsConstructor
    public static class RecentOrderSummary {
        private String orderId;
        private String userEmail;
        private Double totalPrice;
        private String status;
        private String createdAt;
        private String eventName;
    }
}
```

---

## 3. MÔ HÌNH DỮ LIỆU & TRUY VẤN SQL

### 3.1. Truy vấn KPI tổng hệ thống

```sql
-- Tổng doanh thu từ đơn COMPLETED
SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE status = 'COMPLETED';

-- Tổng vé đã bán
SELECT COUNT(t.id)
FROM tickets t
JOIN orders o ON o.id = t.order_id
WHERE o.status = 'COMPLETED';

-- Tổng user (không tính ADMIN)
SELECT COUNT(*) FROM users WHERE role = 'USER';

-- Voucher đang hoạt động
SELECT COUNT(*) FROM vouchers WHERE active = true;
```

### 3.2. Top 3 sự kiện bán chạy nhất

```sql
SELECT
    e.event_name,
    e.cover_image,
    COALESCE(SUM(o.total_price), 0) AS revenue,
    COUNT(t.id) AS tickets_sold,
    (SELECT COUNT(s2.id)
     FROM seats s2
     JOIN zones z2 ON z2.id = s2.zone_id
     JOIN showtimes st2 ON st2.id = z2.showtime_id
     WHERE st2.event_id = e.id) AS total_seats
FROM events e
LEFT JOIN showtimes st ON st.event_id = e.id
LEFT JOIN zones z ON z.showtime_id = st.id
LEFT JOIN seats s ON s.zone_id = z.id
LEFT JOIN tickets t ON t.seat_id = s.id
LEFT JOIN orders o ON o.id = t.order_id AND o.status = 'COMPLETED'
GROUP BY e.id, e.event_name, e.cover_image
ORDER BY revenue DESC
LIMIT 3;
```

### 3.3. Voucher usage summary

> **Lưu ý:** Truy vấn này dựa trên cột `voucher_id` đã có trong bảng `orders` (migration V4).

```sql
SELECT
    v.code,
    v.discount_type,
    v.discount_value,
    v.active,
    COUNT(o.id) AS usage_count,
    COALESCE(SUM(o.discount_amount), 0) AS total_saved
FROM vouchers v
LEFT JOIN orders o ON o.voucher_id = v.id AND o.status = 'COMPLETED'
GROUP BY v.id, v.code, v.discount_type, v.discount_value, v.active
ORDER BY usage_count DESC;
```

### 3.4. 5 đơn hàng gần nhất

```sql
SELECT
    o.id,
    u.email AS user_email,
    o.total_price,
    o.status,
    o.created_at,
    e.event_name
FROM orders o
JOIN users u ON u.id = o.user_id
LEFT JOIN tickets t ON t.order_id = o.id
LEFT JOIN seats s ON s.id = t.seat_id
LEFT JOIN zones z ON z.id = s.zone_id
LEFT JOIN showtimes st ON st.id = z.showtime_id
LEFT JOIN events e ON e.id = st.event_id
GROUP BY o.id, u.email, o.total_price, o.status, o.created_at, e.event_name
ORDER BY o.created_at DESC
LIMIT 5;
```

---

## 4. DANH SÁCH FILE CẦN TẠO MỚI & CHỈNH SỬA

```
backend/
└── src/main/java/com/ticketrush/
    ├── controller/
    │   └── AdminOverviewController.java       [TẠO MỚI: GET /api/admin/overview]
    ├── service/
    │   └── AdminOverviewService.java          [TẠO MỚI: Tổng hợp 4 truy vấn SQL]
    └── model/dto/
        └── AdminOverviewResponse.java         [TẠO MỚI: DTO với 4 nested class]

frontend/
└── src/pages/
    └── AdminDashboard.jsx                     [CHỈNH SỬA: Thay hardcode bằng useQuery]
```

---

## 5. SƠ ĐỒ LUỒNG & THIẾT KẾ UI

### 5.1. Luồng dữ liệu

```
AdminDashboard.jsx
    │
    ├── useQuery("admin-overview") ──► GET /api/admin/overview
    │                                       │
    │                                       ▼
    │                               AdminOverviewService
    │                                       │
    │                               ┌───────┴────────┐
    │                               │   4 SQL Query  │
    │                               │  chạy song song│
    │                               └───────┬────────┘
    │                                       │
    │                               AdminOverviewResponse
    │
    ├── KPI Cards (3 cards)
    ├── Top Events (3 rows table)
    ├── Voucher Summary (table)
    └── Recent Orders (5 rows)
```

### 5.2. Bố cục UI `AdminDashboard.jsx`

```
┌─────────────────────────────────────────────────────────┐
│  Tổng quan hệ thống          ● Verified ADMIN Session    │
├───────────────┬───────────────┬─────────────────────────┤
│ 💰 Doanh Thu  │ 🎟️ Vé Đã Bán │ 👥 Người Dùng           │
│ 24.500.000 đ  │    1.248 vé   │   342 tài khoản         │
├───────────────┴───────────────┴─────────────────────────┤
│  🏆 Top 3 Sự Kiện Bán Chạy                              │
│  #1  Midnight Neon Tour      12.5M đ    94% lấp đầy     │
│  #2  Summer Dance Fest       8.2M đ     78% lấp đầy     │
│  #3  Rock Revival Night      3.8M đ     61% lấp đầy     │
├─────────────────────────────────────────────────────────┤
│  🏷️ Hiệu Quả Voucher                                    │
│  RUSH100 (-100k)   đã dùng 47 lần   tiết kiệm 4.7M đ   │
│  SALE10  (-10%)    đã dùng 23 lần   tiết kiệm 1.9M đ   │
├─────────────────────────────────────────────────────────┤
│  📋 5 Đơn Hàng Gần Nhất                                 │
│  user@gmail.com   2.400.000 đ  COMPLETED  Neon Tour     │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 6. TÍCH HỢP MÃ NGUỒN CHI TIẾT (IMPLEMENTATION BLUEPRINT)

### 6.1. `AdminOverviewController.java`

```java
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminOverviewController {

    private final AdminOverviewService adminOverviewService;

    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminOverviewResponse> getOverview() {
        return ResponseEntity.ok(adminOverviewService.getOverview());
    }
}
```

> **Lưu ý:** Thêm `/api/admin/overview` vào danh sách `hasRole("ADMIN")` trong `SecurityConfig.java`.

### 6.2. `AdminOverviewService.java` (skeleton)

```java
@Service
@RequiredArgsConstructor
public class AdminOverviewService {

    @PersistenceContext
    private EntityManager entityManager;

    public AdminOverviewResponse getOverview() {
        AdminOverviewResponse response = new AdminOverviewResponse();

        response.setTotalRevenue(queryTotalRevenue());
        response.setTotalTicketsSold(queryTotalTicketsSold());
        response.setTotalUsers(queryTotalUsers());
        response.setTotalEvents(queryTotalEvents());
        response.setActiveVouchers(queryActiveVouchers());
        response.setTopEvents(queryTopEvents());
        response.setVoucherSummary(queryVoucherSummary());
        response.setRecentOrders(queryRecentOrders());

        return response;
    }

    // --- Triển khai từng phương thức private với native query như EventAnalyticsService ---
}
```

### 6.3. `AdminDashboard.jsx` (cấu trúc mới)

```jsx
import { useQuery } from "@tanstack/react-query";
import axiosClient from "../api/axiosClient";

function AdminDashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await axiosClient.get("/admin/overview");
      return res.data;
    },
    refetchInterval: 30_000, // Tự động làm mới mỗi 30 giây
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="p-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        <KpiCard label="Tổng doanh thu" value={formatCurrency(overview?.totalRevenue)} />
        <KpiCard label="Vé đã bán" value={formatNumber(overview?.totalTicketsSold)} />
        <KpiCard label="Người dùng" value={formatNumber(overview?.totalUsers)} />
      </div>

      {/* Top Events */}
      <TopEventsTable events={overview?.topEvents} />

      {/* Voucher Summary */}
      <VoucherSummaryTable vouchers={overview?.voucherSummary} />

      {/* Recent Orders */}
      <RecentOrdersTable orders={overview?.recentOrders} />
    </div>
  );
}
```

---

## 7. KẾ HOẠCH KIỂM THỬ

| Test ID | Kịch Bản | Điều Kiện | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **TC-OV01** | **Happy Path - DB có dữ liệu** | Có 3 sự kiện, 10 đơn COMPLETED, 5 voucher đã dùng | Response đầy đủ 4 phần, số liệu khớp với DB |
| **TC-OV02** | **DB trống hoàn toàn (Fresh install)** | Không có đơn, không có user | Tất cả số liệu trả về `0`, arrays rỗng `[]`, không throw exception |
| **TC-OV03** | **Phân quyền - User thường truy cập** | Gọi với JWT của role USER | Trả về `403 Forbidden` |
| **TC-OV04** | **Auto-refresh UI** | Mở dashboard, tạo thêm 1 đơn hàng mới | Sau 30 giây, số liệu trên UI tự cập nhật |
| **TC-OV05** | **Top Events khi chưa có đơn** | Có events nhưng không có đơn COMPLETED | Top events trả về doanh thu = 0, occupancy = 0% |

---

## 8. TIÊU CHUẨN HOÀN THÀNH (DEFINITION OF DONE - DOD)

- [ ] `GET /api/admin/overview` trả về đúng cấu trúc JSON với `200 OK` cho ADMIN token.
- [ ] `GET /api/admin/overview` trả về `403 Forbidden` cho USER token.
- [ ] KPI Cards hiển thị đúng số liệu từ DB (không còn hardcode).
- [ ] Top 3 sự kiện bán chạy hiển thị đúng thứ tự doanh thu giảm dần.
- [ ] Bảng Voucher Summary hiển thị đúng số lần sử dụng và tổng tiết kiệm.
- [ ] Bảng Recent Orders hiển thị 5 đơn mới nhất với trạng thái đúng.
- [ ] Dashboard tự động làm mới dữ liệu mỗi 30 giây (refetchInterval).
- [ ] Toàn bộ trường hợp DB rỗng (fresh install) hiển thị `0` / `[]` thay vì crash.


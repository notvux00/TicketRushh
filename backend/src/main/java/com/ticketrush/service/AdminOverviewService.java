package com.ticketrush.service;

import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOverviewService {
    private final JdbcTemplate db;
    private final AdminVoucherService vouchers;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRevenue", db.queryForObject("SELECT coalesce(sum(total_price),0) FROM orders WHERE status='COMPLETED'", Double.class));
        result.put("totalTicketsSold", db.queryForObject("SELECT count(*) FROM tickets t JOIN orders o ON o.id=t.order_id WHERE o.status='COMPLETED'", Long.class));
        result.put("totalUsers", db.queryForObject("SELECT count(*) FROM users WHERE role='USER'", Long.class));
        result.put("totalEvents", db.queryForObject("SELECT count(*) FROM events", Long.class));
        result.put("activeVouchers", db.queryForObject("SELECT count(*) FROM vouchers WHERE active=true", Long.class));
        // Aggregate orders separately from tickets so multi-seat orders contribute revenue once.
        result.put("topEvents", db.query("""
                WITH event_orders AS (
                  SELECT DISTINCT st.event_id,o.id,o.total_price FROM orders o
                  JOIN tickets t ON t.order_id=o.id JOIN seats s ON s.id=t.seat_id
                  JOIN zones z ON z.id=s.zone_id JOIN showtimes st ON st.id=z.showtime_id
                  WHERE o.status='COMPLETED'
                ), revenue AS (SELECT event_id,sum(total_price) AS amount FROM event_orders GROUP BY event_id),
                seats_summary AS (
                  SELECT st.event_id,count(s.id) AS total_seats,
                    count(t.id) FILTER (WHERE o.status='COMPLETED') AS sold
                  FROM showtimes st JOIN zones z ON z.showtime_id=st.id JOIN seats s ON s.zone_id=z.id
                  LEFT JOIN tickets t ON t.seat_id=s.id LEFT JOIN orders o ON o.id=t.order_id
                  GROUP BY st.event_id
                )
                SELECT e.id,e.event_name,e.cover_image,coalesce(r.amount,0) AS revenue,
                  coalesce(ss.total_seats,0) AS total_seats,coalesce(ss.sold,0) AS sold
                FROM events e LEFT JOIN revenue r ON r.event_id=e.id LEFT JOIN seats_summary ss ON ss.event_id=e.id
                ORDER BY revenue DESC,sold DESC,e.id LIMIT 3
                """, (r,n) -> {
            long total = r.getLong("total_seats"), sold = r.getLong("sold");
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("id",r.getObject("id")); row.put("eventName",r.getString("event_name"));
            row.put("coverImage",r.getString("cover_image")); row.put("revenue",r.getDouble("revenue"));
            row.put("ticketsSold",sold); row.put("totalSeats",total);
            row.put("occupancyRate", total == 0 ? 0.0 : sold * 100.0 / total);
            return row;
        }));
        result.put("voucherSummary", vouchers.list());
        result.put("recentOrders", db.query("""
                SELECT o.id,u.email,o.total_price,o.status,o.created_at,
                  (SELECT e.event_name FROM tickets t JOIN seats s ON s.id=t.seat_id
                   JOIN zones z ON z.id=s.zone_id JOIN showtimes st ON st.id=z.showtime_id
                   JOIN events e ON e.id=st.event_id WHERE t.order_id=o.id ORDER BY t.id LIMIT 1) AS event_name
                FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC,o.id LIMIT 5
                """, (r,n) -> {
            Map<String,Object> row = new LinkedHashMap<>();
            row.put("orderId",r.getObject("id")); row.put("userEmail",r.getString("email"));
            row.put("totalPrice",r.getDouble("total_price")); row.put("status",r.getString("status"));
            row.put("createdAt",AdminVoucherService.utc(r.getObject("created_at", LocalDateTime.class)));
            row.put("eventName",r.getString("event_name")); return row;
        }));
        return result;
    }
}

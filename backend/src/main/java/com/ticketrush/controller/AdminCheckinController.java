package com.ticketrush.controller;

import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/checkin")
@RequiredArgsConstructor
public class AdminCheckinController {
    private final JdbcTemplate db;
    @GetMapping("/search/{showtimeId}")
    public List<Map<String,Object>> search(@PathVariable UUID showtimeId,
                                           @RequestParam(defaultValue = "") String q) {
        if (!Boolean.TRUE.equals(db.queryForObject("SELECT exists(SELECT 1 FROM showtimes WHERE id=?)", Boolean.class, showtimeId)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Suất diễn không tồn tại");
        String needle = q == null ? "" : q.trim().toLowerCase();
        String like = "%" + needle + "%";
        return db.query("""
                SELECT t.id AS ticket_id, t.status, t.checked_in_at,
                       u.full_name, u.email, s.seat_label, z.name AS zone_name
                FROM tickets t
                JOIN orders o ON o.id = t.order_id
                JOIN users u ON u.id = o.user_id
                JOIN seats s ON s.id = t.seat_id
                JOIN zones z ON z.id = s.zone_id
                WHERE z.showtime_id = ? AND o.status = 'COMPLETED'
                  AND (? = ''
                       OR lower(coalesce(u.full_name,'')) LIKE ?
                       OR lower(coalesce(u.email,'')) LIKE ?
                       OR lower(coalesce(s.seat_label,'')) LIKE ?
                       OR lower(t.id::text) LIKE ?)
                ORDER BY u.full_name NULLS LAST, s.seat_label
                LIMIT 20
                """, (rs, n) -> {
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("ticketId", rs.getString("ticket_id"));
            row.put("customerName", rs.getString("full_name"));
            row.put("email", rs.getString("email"));
            row.put("seatLabel", rs.getString("seat_label"));
            row.put("zoneName", rs.getString("zone_name"));
            row.put("status", rs.getString("status"));
            var checkedInAt = rs.getTimestamp("checked_in_at");
            row.put("checkedInAt", checkedInAt == null ? null : checkedInAt.toLocalDateTime().toString());
            return row;
        }, showtimeId, needle, like, like, like, like);
    }

    @GetMapping("/stats/{showtimeId}")
    public Map<String,Object> stats(@PathVariable UUID showtimeId) {
        if (!Boolean.TRUE.equals(db.queryForObject("SELECT exists(SELECT 1 FROM showtimes WHERE id=?)", Boolean.class, showtimeId)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Suất diễn không tồn tại");
        return db.queryForObject("""
                SELECT count(*) AS total,count(*) FILTER (WHERE t.status='CHECKED_IN') AS checked
                FROM tickets t JOIN orders o ON o.id=t.order_id JOIN seats s ON s.id=t.seat_id
                JOIN zones z ON z.id=s.zone_id WHERE z.showtime_id=? AND o.status='COMPLETED'
                """, (r,n) -> {
            long total=r.getLong("total"), checked=r.getLong("checked");
            return Map.of("showtimeId",showtimeId,"totalTickets",total,"checkedIn",checked,
                    "pendingEntry",total-checked,"checkInRate",total==0 ? 0.0 : checked*100.0/total);
        }, showtimeId);
    }
}

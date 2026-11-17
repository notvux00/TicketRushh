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

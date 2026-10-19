package com.ticketrush.repository;
import com.ticketrush.model.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SeatRepository extends JpaRepository<Seat, UUID> {
    List<Seat> findByZoneId(UUID zoneId);

    @Query("""
            SELECT DISTINCT s
            FROM Seat s
            LEFT JOIN FETCH s.tickets t
            LEFT JOIN FETCH t.order o
            WHERE s.zone.id = :zoneId
            ORDER BY s.gridRow ASC, s.gridCol ASC
            """)
    List<Seat> findByZoneIdOrderByGridRowAscGridColAsc(@Param("zoneId") UUID zoneId);

    // Query nhẹ cho trang Booking — fetch zone+showtime để lấy showtimeId, nhưng không JOIN ticket/order
    @Query("""
            SELECT s FROM Seat s
            JOIN FETCH s.zone z
            JOIN FETCH z.showtime st
            WHERE s.zone.id = :zoneId
            ORDER BY s.gridRow ASC, s.gridCol ASC
            """)
    List<Seat> findByZoneIdForBooking(@Param("zoneId") UUID zoneId);
}

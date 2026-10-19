package com.ticketrush.service;

import com.ticketrush.model.dto.EventAnalyticsResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventAnalyticsService {
    @PersistenceContext
    private EntityManager entityManager;

    private static final String COMPLETED_STATUS = "COMPLETED";

    public EventAnalyticsResponse getEventAnalytics(UUID eventId) {
        EventAnalyticsResponse response = new EventAnalyticsResponse();

        Double totalRevenue = getTotalRevenue(eventId);
        Long ticketsSold = getTicketsSold(eventId);
        Long totalSeats = getTotalSeats(eventId);

        response.setTotalRevenue(totalRevenue);
        response.setTicketsSold(ticketsSold);
        response.setTotalSeats(totalSeats);
        response.setOccupancyRate(rate(ticketsSold, totalSeats));
        response.setRevenueTimeline(getRevenueTimeline(eventId));
        response.setOccupancyByZone(getOccupancyByZone(eventId));
        response.setGenderDistribution(getGenderDistribution(eventId));
        response.setAgeDistribution(getAgeDistribution(eventId));

        return response;
    }

    public EventAnalyticsResponse getShowtimeAnalytics(UUID showtimeId) {
        EventAnalyticsResponse response = new EventAnalyticsResponse();

        Double totalRevenue = getShowtimeRevenue(showtimeId);
        Long ticketsSold = getShowtimeTicketsSold(showtimeId);
        Long totalSeats = getShowtimeTotalSeats(showtimeId);

        response.setTotalRevenue(totalRevenue);
        response.setTicketsSold(ticketsSold);
        response.setTotalSeats(totalSeats);
        response.setOccupancyRate(rate(ticketsSold, totalSeats));
        response.setRevenueTimeline(getShowtimeRevenueTimeline(showtimeId));
        response.setOccupancyByZone(getShowtimeOccupancyByZone(showtimeId));
        response.setGenderDistribution(getShowtimeGenderDistribution(showtimeId));
        response.setAgeDistribution(getShowtimeAgeDistribution(showtimeId));

        return response;
    }

    private Double getTotalRevenue(UUID eventId) {
        Object result = entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(o.total_price), 0)
                FROM orders o
                WHERE o.status = :status
                  AND EXISTS (
                    SELECT 1
                    FROM tickets t
                    JOIN seats s ON s.id = t.seat_id
                    JOIN zones z ON z.id = s.zone_id
                    JOIN showtimes st ON st.id = z.showtime_id
                    WHERE t.order_id = o.id AND st.event_id = :eventId
                  )
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("eventId", eventId)
                .getSingleResult();
        return toDouble(result);
    }

    private Long getTicketsSold(UUID eventId) {
        Object result = entityManager.createNativeQuery("""
                SELECT COUNT(t.id)
                FROM tickets t
                JOIN orders o ON o.id = t.order_id
                JOIN seats s ON s.id = t.seat_id
                JOIN zones z ON z.id = s.zone_id
                JOIN showtimes st ON st.id = z.showtime_id
                WHERE o.status = :status AND st.event_id = :eventId
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("eventId", eventId)
                .getSingleResult();
        return toLong(result);
    }

    private Long getTotalSeats(UUID eventId) {
        Object result = entityManager.createNativeQuery("""
                SELECT COUNT(s.id)
                FROM seats s
                JOIN zones z ON z.id = s.zone_id
                JOIN showtimes st ON st.id = z.showtime_id
                WHERE st.event_id = :eventId
                """)
                .setParameter("eventId", eventId)
                .getSingleResult();
        return toLong(result);
    }

    private List<EventAnalyticsResponse.RevenuePoint> getRevenueTimeline(UUID eventId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT DATE(o.created_at) AS revenue_day, COALESCE(SUM(o.total_price), 0) AS revenue
                FROM orders o
                WHERE o.status = :status
                  AND EXISTS (
                    SELECT 1
                    FROM tickets t
                    JOIN seats s ON s.id = t.seat_id
                    JOIN zones z ON z.id = s.zone_id
                    JOIN showtimes st ON st.id = z.showtime_id
                    WHERE t.order_id = o.id AND st.event_id = :eventId
                  )
                GROUP BY DATE(o.created_at)
                ORDER BY revenue_day
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("eventId", eventId)
                .getResultList();

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM");
        return rows.stream()
                .map(row -> new EventAnalyticsResponse.RevenuePoint(
                        ((Date) row[0]).toLocalDate().format(formatter),
                        toDouble(row[1])))
                .toList();
    }

    private List<EventAnalyticsResponse.OccupancyByZone> getOccupancyByZone(UUID eventId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT z.name,
                       COUNT(s.id) AS total_seats,
                       COUNT(t.id) FILTER (WHERE o.status = :status) AS sold_seats
                FROM zones z
                JOIN showtimes st ON st.id = z.showtime_id
                JOIN seats s ON s.zone_id = z.id
                LEFT JOIN tickets t ON t.seat_id = s.id
                LEFT JOIN orders o ON o.id = t.order_id
                WHERE st.event_id = :eventId
                GROUP BY z.name
                ORDER BY z.name
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("eventId", eventId)
                .getResultList();

        return rows.stream()
                .map(row -> {
                    Long totalSeats = toLong(row[1]);
                    Long soldSeats = toLong(row[2]);
                    return new EventAnalyticsResponse.OccupancyByZone(
                            String.valueOf(row[0]),
                            soldSeats,
                            totalSeats,
                            rate(soldSeats, totalSeats));
                })
                .toList();
    }

    private List<EventAnalyticsResponse.DemographicSlice> getGenderDistribution(UUID eventId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT COALESCE(NULLIF(u.gender, ''), 'Unknown') AS gender_label, COUNT(t.id) AS ticket_count
                FROM tickets t
                JOIN orders o ON o.id = t.order_id
                JOIN users u ON u.id = o.user_id
                JOIN seats s ON s.id = t.seat_id
                JOIN zones z ON z.id = s.zone_id
                JOIN showtimes st ON st.id = z.showtime_id
                WHERE o.status = :status AND st.event_id = :eventId
                GROUP BY gender_label
                ORDER BY ticket_count DESC
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("eventId", eventId)
                .getResultList();

        return rows.stream()
                .map(row -> new EventAnalyticsResponse.DemographicSlice(String.valueOf(row[0]), toLong(row[1])))
                .toList();
    }

    private List<EventAnalyticsResponse.AgeBucket> getAgeDistribution(UUID eventId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT age_bucket, COUNT(*) AS ticket_count
                FROM (
                  SELECT CASE
                    WHEN u.date_of_birth IS NULL THEN 'Unknown'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) < 18 THEN '<18'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) BETWEEN 18 AND 24 THEN '18-24'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) BETWEEN 25 AND 34 THEN '25-34'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) BETWEEN 35 AND 44 THEN '35-44'
                    ELSE '45+'
                  END AS age_bucket
                  FROM tickets t
                  JOIN orders o ON o.id = t.order_id
                  JOIN users u ON u.id = o.user_id
                  JOIN seats s ON s.id = t.seat_id
                  JOIN zones z ON z.id = s.zone_id
                  JOIN showtimes st ON st.id = z.showtime_id
                  WHERE o.status = :status AND st.event_id = :eventId
                ) audience
                GROUP BY age_bucket
                ORDER BY CASE age_bucket
                  WHEN '<18' THEN 1
                  WHEN '18-24' THEN 2
                  WHEN '25-34' THEN 3
                  WHEN '35-44' THEN 4
                  WHEN '45+' THEN 5
                  ELSE 6
                END
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("eventId", eventId)
                .getResultList();

        return rows.stream()
                .map(row -> new EventAnalyticsResponse.AgeBucket(String.valueOf(row[0]), toLong(row[1])))
                .toList();
    }

    private Double rate(Long value, Long total) {
        if (total == null || total == 0) {
            return 0.0;
        }
        return Math.round((value == null ? 0.0 : value * 10000.0 / total)) / 100.0;
    }

    private Long toLong(Object value) {
        if (value == null) {
            return 0L;
        }
        return ((Number) value).longValue();
    }

    private Double toDouble(Object value) {
        if (value == null) {
            return 0.0;
        }
        return ((Number) value).doubleValue();
    }

    // ───── Per-Showtime queries ─────

    private Double getShowtimeRevenue(UUID showtimeId) {
        Object result = entityManager.createNativeQuery("""
                SELECT COALESCE(SUM(o.total_price), 0)
                FROM orders o
                WHERE o.status = :status
                  AND EXISTS (
                    SELECT 1
                    FROM tickets t
                    JOIN seats s ON s.id = t.seat_id
                    JOIN zones z ON z.id = s.zone_id
                    WHERE t.order_id = o.id AND z.showtime_id = :showtimeId
                  )
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("showtimeId", showtimeId)
                .getSingleResult();
        return toDouble(result);
    }

    private Long getShowtimeTicketsSold(UUID showtimeId) {
        Object result = entityManager.createNativeQuery("""
                SELECT COUNT(t.id)
                FROM tickets t
                JOIN orders o ON o.id = t.order_id
                JOIN seats s ON s.id = t.seat_id
                JOIN zones z ON z.id = s.zone_id
                WHERE o.status = :status AND z.showtime_id = :showtimeId
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("showtimeId", showtimeId)
                .getSingleResult();
        return toLong(result);
    }

    private Long getShowtimeTotalSeats(UUID showtimeId) {
        Object result = entityManager.createNativeQuery("""
                SELECT COUNT(s.id)
                FROM seats s
                JOIN zones z ON z.id = s.zone_id
                WHERE z.showtime_id = :showtimeId
                """)
                .setParameter("showtimeId", showtimeId)
                .getSingleResult();
        return toLong(result);
    }

    private List<EventAnalyticsResponse.RevenuePoint> getShowtimeRevenueTimeline(UUID showtimeId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT DATE(o.created_at) AS revenue_day, COALESCE(SUM(o.total_price), 0) AS revenue
                FROM orders o
                WHERE o.status = :status
                  AND EXISTS (
                    SELECT 1
                    FROM tickets t
                    JOIN seats s ON s.id = t.seat_id
                    JOIN zones z ON z.id = s.zone_id
                    WHERE t.order_id = o.id AND z.showtime_id = :showtimeId
                  )
                GROUP BY DATE(o.created_at)
                ORDER BY revenue_day
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("showtimeId", showtimeId)
                .getResultList();

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM");
        return rows.stream()
                .map(row -> new EventAnalyticsResponse.RevenuePoint(
                        ((Date) row[0]).toLocalDate().format(formatter),
                        toDouble(row[1])))
                .toList();
    }

    private List<EventAnalyticsResponse.OccupancyByZone> getShowtimeOccupancyByZone(UUID showtimeId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT z.name,
                       COUNT(s.id) AS total_seats,
                       COUNT(t.id) FILTER (WHERE o.status = :status) AS sold_seats
                FROM zones z
                JOIN seats s ON s.zone_id = z.id
                LEFT JOIN tickets t ON t.seat_id = s.id
                LEFT JOIN orders o ON o.id = t.order_id
                WHERE z.showtime_id = :showtimeId
                GROUP BY z.name
                ORDER BY z.name
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("showtimeId", showtimeId)
                .getResultList();

        return rows.stream()
                .map(row -> {
                    Long totalSeats = toLong(row[1]);
                    Long soldSeats = toLong(row[2]);
                    return new EventAnalyticsResponse.OccupancyByZone(
                            String.valueOf(row[0]),
                            soldSeats,
                            totalSeats,
                            rate(soldSeats, totalSeats));
                })
                .toList();
    }

    private List<EventAnalyticsResponse.DemographicSlice> getShowtimeGenderDistribution(UUID showtimeId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT COALESCE(NULLIF(u.gender, ''), 'Unknown') AS gender_label, COUNT(t.id) AS ticket_count
                FROM tickets t
                JOIN orders o ON o.id = t.order_id
                JOIN users u ON u.id = o.user_id
                JOIN seats s ON s.id = t.seat_id
                JOIN zones z ON z.id = s.zone_id
                WHERE o.status = :status AND z.showtime_id = :showtimeId
                GROUP BY gender_label
                ORDER BY ticket_count DESC
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("showtimeId", showtimeId)
                .getResultList();

        return rows.stream()
                .map(row -> new EventAnalyticsResponse.DemographicSlice(String.valueOf(row[0]), toLong(row[1])))
                .toList();
    }

    private List<EventAnalyticsResponse.AgeBucket> getShowtimeAgeDistribution(UUID showtimeId) {
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT age_bucket, COUNT(*) AS ticket_count
                FROM (
                  SELECT CASE
                    WHEN u.date_of_birth IS NULL THEN 'Unknown'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) < 18 THEN '<18'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) BETWEEN 18 AND 24 THEN '18-24'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) BETWEEN 25 AND 34 THEN '25-34'
                    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.date_of_birth)) BETWEEN 35 AND 44 THEN '35-44'
                    ELSE '45+'
                  END AS age_bucket
                  FROM tickets t
                  JOIN orders o ON o.id = t.order_id
                  JOIN users u ON u.id = o.user_id
                  JOIN seats s ON s.id = t.seat_id
                  JOIN zones z ON z.id = s.zone_id
                  WHERE o.status = :status AND z.showtime_id = :showtimeId
                ) audience
                GROUP BY age_bucket
                ORDER BY CASE age_bucket
                  WHEN '<18' THEN 1
                  WHEN '18-24' THEN 2
                  WHEN '25-34' THEN 3
                  WHEN '35-44' THEN 4
                  WHEN '45+' THEN 5
                  ELSE 6
                END
                """)
                .setParameter("status", COMPLETED_STATUS)
                .setParameter("showtimeId", showtimeId)
                .getResultList();

        return rows.stream()
                .map(row -> new EventAnalyticsResponse.AgeBucket(String.valueOf(row[0]), toLong(row[1])))
                .toList();
    }
}

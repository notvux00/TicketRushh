package com.ticketrush.repository;

import com.ticketrush.model.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface EventRepository extends JpaRepository<Event, UUID> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE events
            SET cover_image = :coverImage,
                description = :description,
                venue_name = :venueName,
                venue_address = :venueAddress,
                max_tickets_per_order = :maxTicketsPerOrder
            WHERE id = :eventId
            """, nativeQuery = true)
    void updateEditableFields(
            @Param("eventId") UUID eventId,
            @Param("coverImage") String coverImage,
            @Param("description") String description,
            @Param("venueName") String venueName,
            @Param("venueAddress") String venueAddress,
            @Param("maxTicketsPerOrder") Integer maxTicketsPerOrder);

    @Modifying
    @Query(value = "DELETE FROM tickets USING seats, zones, showtimes WHERE tickets.seat_id = seats.id AND seats.zone_id = zones.id AND zones.showtime_id = showtimes.id AND showtimes.event_id = :eventId", nativeQuery = true)
    void deleteTicketsByEventId(@Param("eventId") UUID eventId);

    @Modifying
    @Query(value = "DELETE FROM seats USING zones, showtimes WHERE seats.zone_id = zones.id AND zones.showtime_id = showtimes.id AND showtimes.event_id = :eventId", nativeQuery = true)
    void deleteSeatsByEventId(@Param("eventId") UUID eventId);

    @Modifying
    @Query(value = "DELETE FROM zones USING showtimes WHERE zones.showtime_id = showtimes.id AND showtimes.event_id = :eventId", nativeQuery = true)
    void deleteZonesByEventId(@Param("eventId") UUID eventId);

    @Modifying
    @Query(value = "DELETE FROM showtimes WHERE event_id = :eventId", nativeQuery = true)
    void deleteShowtimesByEventId(@Param("eventId") UUID eventId);

    @Modifying
    @Query(value = "DELETE FROM events WHERE id = :eventId", nativeQuery = true)
    void deleteEventById(@Param("eventId") UUID eventId);
}

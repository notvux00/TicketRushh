package com.ticketrush.repository;

import com.ticketrush.model.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, UUID> {
    @org.springframework.data.jpa.repository.Query("""
            select count(t) from Ticket t join t.order o
            where t.seat.zone.showtime.event.id = :eventId
              and (o.status = 'COMPLETED' or t.status = 'CHECKED_IN'
                   or (o.status = 'PENDING' and (o.expiresAt is null or o.expiresAt >= :now)))
            """)
    long protectedTicketsForEvent(@org.springframework.data.repository.query.Param("eventId") UUID eventId,
                                  @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);

    @org.springframework.data.jpa.repository.Query("""
            select count(t) from Ticket t join t.order o
            where t.seat.zone.id = :zoneId
              and (o.status = 'COMPLETED' or t.status = 'CHECKED_IN'
                   or (o.status = 'PENDING' and (o.expiresAt is null or o.expiresAt >= :now)))
            """)
    long protectedTicketsForZone(@org.springframework.data.repository.query.Param("zoneId") UUID zoneId,
                                 @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select t from Ticket t where t.id = :id")
    Optional<Ticket> findForCheckin(@org.springframework.data.repository.query.Param("id") UUID id);

    List<Ticket> findByOrderId(UUID orderId);
    List<Ticket> findBySeatIdIn(List<UUID> seatIds);
    Optional<Ticket> findByQrPayload(String qrPayload);
    Optional<Ticket> findByQrCode(String qrCode);
}

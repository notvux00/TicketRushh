package com.ticketrush.repository;

import com.ticketrush.model.entity.TicketCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TicketCheckinRepository extends JpaRepository<TicketCheckin, UUID> {
    List<TicketCheckin> findByTicketIdOrderByScannedAtDesc(UUID ticketId);
}


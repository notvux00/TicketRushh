package com.ticketrush.model.entity;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ticket_checkins")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketCheckin {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @Column(name = "scanned_at", nullable = false)
    private LocalDateTime scannedAt;

    @Column(name = "gate_name", length = 50)
    private String gateName;

    @Column(name = "device_id", length = 100)
    private String deviceId;

    @Column(name = "staff_email", length = 100)
    private String staffEmail;

    @Column(name = "result", length = 30, nullable = false)
    private String result;
}


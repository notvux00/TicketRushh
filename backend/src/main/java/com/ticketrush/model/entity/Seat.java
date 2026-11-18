package com.ticketrush.model.entity;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "seats")
@Getter
@Setter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = {"zone", "lockedByUser", "tickets"})
public class Seat {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    private String seatLabel;

    private String status = "AVAILABLE";

    private Integer gridRow;
    private Integer gridCol;

    @ManyToOne
    @JoinColumn(name = "zone_id", nullable = false)
    private Zone zone;

    private LocalDateTime lockedAt;

    @ManyToOne
    @JoinColumn(name = "locked_by")
    private User lockedByUser;

    @OneToMany(mappedBy = "seat", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private java.util.List<Ticket> tickets;
}

package com.ticketrush.model.entity;

import java.util.UUID;
import java.time.LocalDateTime;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "seats")
@Data
public class Seat {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
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
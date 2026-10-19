package com.ticketrush.model.entity;

import java.util.UUID;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "zones")
@Data
public class Zone {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;
    private Integer matrixRow;
    private Integer matrixCol;

    @ManyToOne
    @JoinColumn(name = "showtime_id", nullable = false)
    private Showtime showtime;

    @Column(name = "position_x")
    private Integer positionX = 0;

    @Column(name = "position_y")
    private Integer positionY = 0;

    @Column(name = "visual_width")
    private Integer visualWidth = 160;

    @Column(name = "visual_height")
    private Integer visualHeight = 120;
    
    @Column(name = "price")
    private Double price = 0.0;

    @OneToMany(mappedBy = "zone", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private java.util.List<Seat> seats;
}
package com.ticketrush.model.entity;

import java.util.List;
import java.util.UUID;
import java.util.List;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "events")
@Data
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String eventName;

    @Column(columnDefinition = "TEXT")
    private String description;
    
    private String coverImage;
    private String trailerUrl;
    private String venueName;
    private String venueAddress;
    private String category;
    private Integer maxTicketsPerOrder;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User creator;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Showtime> showtimes;
}
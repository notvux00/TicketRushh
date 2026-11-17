package com.ticketrush.model.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "vouchers")
@Data
public class Voucher {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    private String description;

    @Column(nullable = false, length = 20)
    private String discountType; // "FIXED_AMOUNT" or "PERCENTAGE"

    @Column(nullable = false)
    private Double discountValue;

    private Double maxDiscount;

    private Double minOrderPrice;

    private Integer totalQuantity = 1000;

    @Column(nullable = false)
    private Integer usedQuantity = 0;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now(com.ticketrush.util.EventTime.ZONE);

    @Column(updatable = false, length = 100)
    private String createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private Event event;
}


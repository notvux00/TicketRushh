package com.ticketrush.model.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class VoucherResponse {
    private UUID id;
    private String code;
    private String description;
    private String discountType; // "FIXED_AMOUNT" or "PERCENTAGE"
    private Double discountValue;
    private Double maxDiscount;
    private Double minOrderPrice;
    private Integer totalQuantity;
    private Integer usedQuantity;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private Boolean active;
    private UUID eventId;
    private String eventName;
}


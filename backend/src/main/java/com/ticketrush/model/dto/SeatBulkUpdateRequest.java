package com.ticketrush.model.dto;

import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
public class SeatBulkUpdateRequest {
    private List<UUID> seatIds;
    private String status; // Dùng để cập nhật hàng loạt thành AISLE hoặc AVAILABLE
}

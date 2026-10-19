package com.ticketrush.model.dto;

import lombok.Data;

@Data
public class QueueStatusResponse {
    private boolean needQueue;            // true = phải xếp hàng
    private boolean accessGranted;        // true = đã được cấp thẻ, vào booking được
    private Integer position;             // Vị trí trong hàng chờ (1-indexed, null nếu chưa join)
    private Integer totalInQueue;         // Tổng người đang chờ
    private Integer estimatedWaitSeconds; // Ước tính thời gian chờ
    private Integer activeUsers;          // Số người đang trong booking
    private String message;               // Thông báo cho user
}

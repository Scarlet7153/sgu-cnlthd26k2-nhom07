package com.pcshop.order_service.dto.websocket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusUpdateMessage {
    private String orderId;
    private String accountId;
    private String oldStatus;
    private String newStatus;
    private String message;
    private Instant timestamp;
}

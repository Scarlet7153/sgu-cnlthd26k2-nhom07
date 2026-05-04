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
public class NewOrderNotificationMessage {
    private String orderId;
    private String accountId;
    private String customerName;
    private Long total;
    private String paymentMethod;
    private Instant timestamp;
}

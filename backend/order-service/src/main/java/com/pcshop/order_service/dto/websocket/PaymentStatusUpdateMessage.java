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
public class PaymentStatusUpdateMessage {
    private String orderId;
    private String accountId;
    private String paymentStatus; // paid, unpaid, refunded
    private String paymentMethod;
    private Long amount;
    private String message;
    private Instant timestamp;
}

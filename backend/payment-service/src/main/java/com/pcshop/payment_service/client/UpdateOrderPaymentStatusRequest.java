package com.pcshop.payment_service.client;

import lombok.Data;

@Data
public class UpdateOrderPaymentStatusRequest {
    private String paymentStatus;
}

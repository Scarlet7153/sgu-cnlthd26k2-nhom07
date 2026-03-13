package com.pcshop.order_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateOrderRequest {
    @NotBlank(message = "payment_method is required")
    private String paymentMethod; // VNPAY | MOMO | COD | BANK_TRANSFER

    private String note;
}

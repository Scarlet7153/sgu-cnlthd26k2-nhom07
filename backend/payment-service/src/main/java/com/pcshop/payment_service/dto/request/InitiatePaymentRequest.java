package com.pcshop.payment_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InitiatePaymentRequest {
    @NotBlank(message = "orderId is required")
    private String orderId;

    @NotNull(message = "amount is required")
    private Long amount;

    @NotBlank(message = "method is required")
    private String method; // VNPAY | MOMO | COD | BANK_TRANSFER
}

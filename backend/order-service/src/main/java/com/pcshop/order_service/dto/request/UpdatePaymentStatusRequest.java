package com.pcshop.order_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdatePaymentStatusRequest {
    @NotBlank(message = "paymentStatus is required")
    private String paymentStatus; // unpaid | paid | refunded
}

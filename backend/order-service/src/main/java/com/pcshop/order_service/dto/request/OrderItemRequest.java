package com.pcshop.order_service.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OrderItemRequest {
    @NotBlank(message = "productId is required")
    private String productId;

    @Min(value = 1, message = "quantity must be >= 1")
    private Integer quantity;

    // Optional snapshot from frontend to avoid calling product-service
    private String productName;
    private Long productPrice;
    private String productImage; // Optional image snapshot
}

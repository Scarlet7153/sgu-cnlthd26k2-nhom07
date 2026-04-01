package com.pcshop.order_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateOrderRequest {
    @NotBlank(message = "payment_method is required")
    private String paymentMethod; // VNPAY | MOMO | COD | BANK_TRANSFER

    private String note;

    // Fields sent by FE (client-side cart)
    private List<OrderItemRequest> items;
    private ShippingAddressRequest shippingAddress;
    private Long totalPrice;

    @Data
    public static class OrderItemRequest {
        private String productId;
        private String productName;
        private Long productPrice;
        private Integer quantity;
        private String productImage;
    }
}


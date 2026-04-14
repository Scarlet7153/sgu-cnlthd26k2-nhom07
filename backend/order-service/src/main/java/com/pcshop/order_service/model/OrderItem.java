package com.pcshop.order_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {
    @Field("product_id")
    private String productId;

    @Field("product_name")
    private String productName;

    @Field("product_price")
    private Long productPrice; // VNĐ tại thời điểm đặt

    private Integer quantity;

    @Field("total_price")
    private Long totalPrice; // product_price * quantity

    @Field("product_image")
    private String productImage;

    @Field("warranty_months")
    private Integer warrantyMonths;
}

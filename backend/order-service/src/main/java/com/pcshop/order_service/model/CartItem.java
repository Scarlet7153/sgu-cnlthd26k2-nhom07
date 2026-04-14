package com.pcshop.order_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Redis cart item model.
 * Stored as JSON in Redis with key: cart:{account_id}
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItem implements Serializable {
    private String productId;
    private String productName;
    private Long price;
    private Integer quantity;
    private String productImage;
}

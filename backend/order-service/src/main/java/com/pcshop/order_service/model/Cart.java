package com.pcshop.order_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Redis cart object.
 * Key: cart:{account_id}
 * Value: JSON { items: [...], updated_at: ... }
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cart implements Serializable {
    @Builder.Default
    private List<CartItem> items = new ArrayList<>();

    private Instant updatedAt;
}

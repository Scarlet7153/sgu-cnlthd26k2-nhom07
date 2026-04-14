package com.pcshop.order_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "orders")
@CompoundIndex(name = "idx_account_status_date",
        def = "{'account_id': 1, 'status': 1, 'created_at': -1}")
public class Order {
    @Id
    private String id;

    @Indexed
    @Field("account_id")
    private String accountId; // ref → accounts._id

    @Indexed
    @Builder.Default
    private String status = "pending"; // pending | confirmed | shipping | delivered | cancelled

    @Field("payment_method")
    private String paymentMethod; // VNPAY | MOMO | COD | BANK_TRANSFER

    @Field("payment_status")
    @Builder.Default
    private String paymentStatus = "unpaid"; // unpaid | paid | refunded

    private List<OrderItem> items; // embedded snapshot

    @Field("shipping_address")
    private ShippingAddress shippingAddress;

    private Long total; // VNĐ integer

    private String note;

    @Field("history_status")
    @Builder.Default
    private List<StatusHistory> historyStatus = new ArrayList<>();

    @Field("cancel_reason")
    private String cancelReason;

    @CreatedDate
    @Indexed
    @Field("created_at")
    private Instant createdAt;

    @LastModifiedDate
    @Field("updated_at")
    private Instant updatedAt;
}

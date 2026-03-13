package com.pcshop.payment_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
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
@Document(collection = "payments")
public class Payment {
    @Id
    private String id;

    @Indexed
    @Field("order_id")
    private String orderId; // ref → orders._id

    @Indexed
    @Field("account_id")
    private String accountId; // ref → accounts._id

    private Long amount; // VNĐ integer > 0

    @Builder.Default
    private String currency = "VND";

    private String method; // VNPAY | MOMO | COD | BANK_TRANSFER

    @Indexed
    @Builder.Default
    private String status = "pending"; // pending | success | failed | refunded

    @Field("provider_transaction_id")
    private String providerTransactionId;

    @Field("provider_response")
    private String providerResponse; // JSON string

    @Builder.Default
    private List<PaymentLog> logs = new ArrayList<>();

    @Field("paid_at")
    private Instant paidAt;

    @Field("refunded_at")
    private Instant refundedAt;

    @CreatedDate
    @Field("created_at")
    private Instant createdAt;
}

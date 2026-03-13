package com.pcshop.payment_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentLog {
    private String action; // create_payment_url | verify_payment | refund

    private String status; // success | failed

    @Field("request_data")
    private String requestData; // JSON string

    @Field("response_data")
    private String responseData; // JSON string

    @Field("created_at")
    private Instant createdAt;
}

package com.pcshop.order_service.model;

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
public class StatusHistory {
    private String status;
    private String note;

    @Field("change_by")
    private String changeBy; // system | admin_id | user_id

    @Field("created_at")
    private Instant createdAt;
}

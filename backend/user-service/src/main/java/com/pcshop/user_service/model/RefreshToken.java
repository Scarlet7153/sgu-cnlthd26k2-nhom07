package com.pcshop.user_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "refresh_tokens")
public class RefreshToken {
    @Id
    private String id;

    @Field("account_id")
    @Indexed
    private String accountId;

    @Indexed(unique = true)
    private String token;

    @Field("expires_at")
    @Indexed(expireAfterSeconds = 0) // TTL index — auto-delete when expiresAt is reached
    private Instant expiresAt;

    @Field("created_at")
    private Instant createdAt;
}

package com.pcshop.auth_service.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "otp")
public class Otp {
    @Id
    private String id;

    @Indexed(expireAfterSeconds = 900) // 15 minutes
    private Instant createdAt;

    private String email;
    private String code; // 6-digit OTP
    private int attempts; // Track failed attempts
    private Instant expiresAt;

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public boolean isValid(String inputCode) {
        return !isExpired() && this.code.equals(inputCode) && attempts < 5; // Max 5 attempts
    }
}

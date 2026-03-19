package com.pcshop.auth_service.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterResponse {
    private String message;

    @JsonProperty("email")
    private String email;

    @JsonProperty("otp_expires_in")
    private long otpExpiresIn; // seconds
}

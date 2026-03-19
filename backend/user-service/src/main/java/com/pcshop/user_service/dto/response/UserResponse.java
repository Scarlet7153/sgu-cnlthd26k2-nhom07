package com.pcshop.user_service.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.pcshop.user_service.model.AddressDetails;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    private String id;
    private String username;

    @JsonProperty("fullName")  // FE expects fullName
    private String name;

    private String email;
    private String phone;
    private String role;
    private String status;
    private AddressDetails addressDetails;
    private Instant createdAt;
}


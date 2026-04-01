package com.pcshop.auth_service.dto.response;

import com.pcshop.auth_service.model.AddressDetails;
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
    private String email;
    private String fullName;
    private String phone;
    private String role;
    private String status;
    private AddressDetails addressDetails;
    private Instant createdAt;
}

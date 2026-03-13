package com.pcshop.user_service.dto.request;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String name;

    @Email(message = "Invalid email format")
    private String email;

    private String phone;

    // Address details
    private String houseNumber;
    private String street;
    private String ward;
    private String province;
}

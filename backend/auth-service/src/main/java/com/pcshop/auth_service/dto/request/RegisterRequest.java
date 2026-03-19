package com.pcshop.auth_service.dto.request;

import jakarta.validation.constraints   .Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "Fullname is required")
    @Size(min = 3, max = 100, message = "Fullname must be 3-100 characters")
    private String fullName;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be at least 6 characters")
    private String password;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    private String phone;

    // Address details (optional at registration)
    private String houseNumber;
    private String street;
    private String ward;
    private String province;
}

package com.pcshop.user_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateStatusRequest {
    @NotBlank(message = "Status is required")
    private String status; // active | inactive | banned
}

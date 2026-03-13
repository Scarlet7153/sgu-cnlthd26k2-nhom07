package com.pcshop.order_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateOrderStatusRequest {
    @NotBlank(message = "status is required")
    private String status; // pending | confirmed | shipping | delivered | cancelled

    private String note;
}

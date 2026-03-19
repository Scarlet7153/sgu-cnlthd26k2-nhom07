package com.pcshop.order_service.dto.request;

import lombok.Data;

@Data
public class ShippingAddressRequest {
    private String fullName;
    private String phone;
    private String email;
    private String address;
}

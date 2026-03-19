package com.pcshop.order_service.model;

import lombok.Data;

@Data
public class ShippingAddress {
    private String fullName;
    private String phone;
    private String email;
    private String address;
}

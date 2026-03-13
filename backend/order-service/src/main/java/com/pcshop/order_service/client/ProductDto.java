package com.pcshop.order_service.client;

import lombok.Data;

@Data
public class ProductDto {
    private String id;
    private String name;
    private Long price;
}

package com.pcshop.product_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ProductRequest {
    @NotBlank(message = "categoryID is required")
    private String categoryID;

    @NotBlank(message = "Name is required")
    private String name;

    private String model;
    private String url;

    @NotNull(message = "Price is required")
    private Long price;

    private String image;
    private String socket;
    private List<String> ramType;
    private Boolean hasIgpu;
    private String igpuName;
    private Integer tdpW;
    private Integer cores;
    private Integer threads;
    private Double baseClockGhz;
    private Double boostClockGhz;
    private Map<String, Object> specsRaw;
}

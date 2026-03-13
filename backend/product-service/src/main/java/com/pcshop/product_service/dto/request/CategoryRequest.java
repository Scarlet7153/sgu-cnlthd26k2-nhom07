package com.pcshop.product_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CategoryRequest {
    @NotBlank(message = "Code is required")
    private String code;

    @NotBlank(message = "Name is required")
    private String name;

    private Boolean isActive;

    private List<SubcategoryRequest> subcategory;

    @Data
    public static class SubcategoryRequest {
        private String name;
        private String filterQuery;
    }
}

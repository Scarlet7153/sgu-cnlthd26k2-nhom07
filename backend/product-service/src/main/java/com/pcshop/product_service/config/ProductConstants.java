package com.pcshop.product_service.config;

import java.util.Set;

/**
 * Centralized constants for Product Service to prevent hardcoded strings
 * and enable easy maintenance of magic values.
 */
public final class ProductConstants {
    
    // ==================== Collections ====================
    public static final String COLLECTION_PRODUCTS = "products";
    public static final String COLLECTION_CATEGORIES = "categories";
    
    // ==================== Product Fields ====================
    public static final String FIELD_ID = "_id";
    public static final String FIELD_CATEGORY_ID = "categoryId";
    public static final String FIELD_PRICE = "price";
    public static final String FIELD_NAME = "name";
    public static final String FIELD_MODEL = "model";
    public static final String FIELD_SOCKET = "socket";
    public static final String FIELD_SPECS_RAW = "specs_raw";
    public static final String FIELD_IS_ACTIVE = "is_active";
    public static final String FIELD_CODE = "code";
    
    // ==================== Brand Fields ====================
    public static final String FIELD_BRAND = FIELD_SPECS_RAW + ".Thương hiệu";
    
    // ==================== Aggregation Fields ====================
    public static final String CATEGORY_DOCS_FIELD = "category_docs";
    public static final String CATEGORY_ACTIVE_FIELD = CATEGORY_DOCS_FIELD + "." + FIELD_IS_ACTIVE;
    
    // ==================== Search Configuration ====================
    public static final int MAX_SEARCH_TOKENS = 6;
    public static final Set<String> ALLOWED_SPEC_FIELDS = Set.of(
        "type",
        "efficiency",
        "case_type",
        "cooler_type",
        "Thương hiệu"
    );
    public static final int MAX_SPEC_VALUE_LENGTH = 100;
    public static final String SPEC_VALUE_PATTERN = "[\\p{L}\\d\\s\\-_]+";
    
    // ==================== Pagination ====================
    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;
    
    // ==================== Caching ====================
    public static final long CACHE_TTL_MINUTES = 60;
    
    // ==================== Error Messages ====================
    public static final String ERROR_INVALID_CATEGORY_ID = "Invalid category ID format: ";
    public static final String ERROR_CATEGORY_NOT_FOUND = "Category not found";
    public static final String ERROR_PRODUCT_NOT_FOUND = "Product not found";
    public static final String ERROR_INVALID_SPEC_FIELD = "Trường lọc không hợp lệ";
    public static final String ERROR_INVALID_PRICE_RANGE = "Giá tối thiểu không thể lớn hơn giá tối đa";
    public static final String ERROR_INVALID_SPEC_VALUE = "Giá trị lọc chứa ký tự không hợp lệ";
    public static final String ERROR_INVALID_CATEGORY_CODE = "Mã danh mục không hợp lệ";
    
    private ProductConstants() {
        throw new AssertionError("Cannot instantiate constants class");
    }
}

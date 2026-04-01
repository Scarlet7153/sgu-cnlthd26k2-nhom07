package com.pcshop.product_service.util;

import com.pcshop.product_service.config.ProductConstants;
import com.pcshop.product_service.exception.BadRequestException;
import org.bson.types.ObjectId;
import lombok.extern.slf4j.Slf4j;

/**
 * Input validation and sanitization utilities for security.
 * Prevents NoSQL injection and invalid data access.
 */
@Slf4j
public final class InputValidationUtil {
    
    private InputValidationUtil() {
        throw new AssertionError("Cannot instantiate utility class");
    }
    
    /**
     * Validate and sanitize spec field name against whitelist.
     * Throws exception if not in allowed fields.
     */
    public static String validateSpecField(String specField) {
        if (specField == null || specField.trim().isEmpty()) {
            throw new BadRequestException(ProductConstants.ERROR_INVALID_SPEC_FIELD);
        }
        
        if (!ProductConstants.ALLOWED_SPEC_FIELDS.contains(specField)) {
            log.warn("Invalid spec field attempted: {}", specField);
            throw new BadRequestException(ProductConstants.ERROR_INVALID_SPEC_FIELD);
        }
        
        return specField.trim();
    }
    
    /**
     * Sanitize spec value to prevent injection attacks.
     * Whitelist: alphanumeric, spaces, hyphens, underscores.
     */
    public static String sanitizeSpecValue(String value) {
        if (value == null) {
            return "";
        }
        
        String trimmed = value.trim();
        
        // Limit length first
        if (trimmed.length() > ProductConstants.MAX_SPEC_VALUE_LENGTH) {
            trimmed = trimmed.substring(0, ProductConstants.MAX_SPEC_VALUE_LENGTH);
        }
        
        // Validate pattern: allow Unicode letters, digits, spaces, hyphens, underscores
        if (!trimmed.matches(ProductConstants.SPEC_VALUE_PATTERN)) {
            log.warn("Invalid spec value format detected, sanitizing: {}", value);
            throw new BadRequestException(ProductConstants.ERROR_INVALID_SPEC_VALUE);
        }
        
        return trimmed;
    }
    
    /**
     * Validate price range.
     */
    public static void validatePriceRange(Long minPrice, Long maxPrice) {
        if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
            throw new BadRequestException(ProductConstants.ERROR_INVALID_PRICE_RANGE);
        }
        
        if (minPrice != null && minPrice < 0) {
            throw new BadRequestException("Giá tối thiểu không thể âm");
        }
        
        if (maxPrice != null && maxPrice < 0) {
            throw new BadRequestException("Giá tối đa không thể âm");
        }
    }
    
    /**
     * Validate ObjectId format.
     */
    public static boolean isValidObjectId(String id) {
        try {
            new ObjectId(id);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
    
    /**
     * Validate non-empty string.
     */
    public static boolean isValidString(String value) {
        return value != null && !value.trim().isEmpty();
    }
    
    /**
     * Validate keyword for search, limit to reasonable length.
     */
    public static String validateSearchKeyword(String keyword) {
        if (keyword == null) {
            return "";
        }
        
        String trimmed = keyword.trim();
        
        // Limit keyword length to prevent DoS
        if (trimmed.length() > 200) {
            trimmed = trimmed.substring(0, 200);
        }
        
        return trimmed;
    }
}

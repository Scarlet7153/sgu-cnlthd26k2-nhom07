package com.pcshop.payment_service.config;

import java.util.List;

/**
 * Centralized constants for Payment Service.
 */
public final class PaymentConstants {
    
    // ==================== Payment Methods ====================
    public static final String METHOD_MOMO = "MOMO";
    public static final String METHOD_COD = "COD";
    
    public static final List<String> VALID_METHODS = List.of(
        METHOD_MOMO,
        METHOD_COD
    );
    
    // ==================== Payment Status ====================
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_SUCCESS = "success";
    public static final String STATUS_FAILED = "failed";
    public static final String STATUS_REFUNDED = "refunded";
    
    // ==================== MoMo Constants ====================
    public static final int MOMO_SUCCESS_CODE = 0;
    public static final String MOMO_SEPARATOR = "_";
    
    // ==================== Payment Log Actions ====================
    public static final String ACTION_CREATE_PAYMENT_URL = "create_payment_url";
    public static final String ACTION_COD_CONFIRM = "cod_confirm";
    public static final String ACTION_CALLBACK = "callback";
    
    // ==================== Error Messages ====================
    public static final String ERROR_INVALID_METHOD = "Invalid payment method. Must be one of: ";
    public static final String ERROR_PAYMENT_ALREADY_COMPLETED = "Payment already completed for this order with status: ";
    public static final String ERROR_INVALID_SIGNATURE = "Invalid MoMo signature";
    public static final String ERROR_MISSING_ORDER_ID = "MoMo orderId bắt buộc";
    public static final String ERROR_INVALID_CALLBACK_DATA = "Callback data không hợp lệ";
    
    private PaymentConstants() {
        throw new AssertionError("Cannot instantiate constants class");
    }
}

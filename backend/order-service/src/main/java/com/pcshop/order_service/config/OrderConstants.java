package com.pcshop.order_service.config;

import java.util.List;

/**
 * Centralized constants for Order Service to prevent hardcoded status values
 * and magic strings.
 */
public final class OrderConstants {
    
    // ==================== Order Statuses ====================
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_CONFIRMED = "confirmed";
    public static final String STATUS_SHIPPING = "shipping";
    public static final String STATUS_DELIVERED = "delivered";
    public static final String STATUS_CANCELLED = "cancelled";
    
    public static final List<String> VALID_STATUSES = List.of(
        STATUS_PENDING,
        STATUS_CONFIRMED,
        STATUS_SHIPPING,
        STATUS_DELIVERED,
        STATUS_CANCELLED
    );
    
    public static final List<String> FINAL_STATUSES = List.of(
        STATUS_CANCELLED,
        STATUS_DELIVERED
    );
    
    // ==================== Payment Methods ====================
    public static final String METHOD_MOMO = "MOMO";
    public static final String METHOD_COD = "COD";
    
    public static final List<String> VALID_PAYMENT_METHODS = List.of(
        METHOD_MOMO,
        METHOD_COD
    );
    
    // ==================== Payment Statuses ====================
    public static final String PAYMENT_STATUS_UNPAID = "unpaid";
    public static final String PAYMENT_STATUS_PAID = "paid";
    public static final String PAYMENT_STATUS_REFUNDED = "refunded";
    
    public static final List<String> VALID_PAYMENT_STATUSES = List.of(
        PAYMENT_STATUS_UNPAID,
        PAYMENT_STATUS_PAID,
        PAYMENT_STATUS_REFUNDED
    );
    
    // ==================== Field Names ====================
    public static final String FIELD_ACCOUNT_ID = "accountId";
    public static final String FIELD_STATUS = "status";
    public static final String FIELD_PAYMENT_STATUS = "paymentStatus";
    public static final String FIELD_CREATED_AT = "createdAt";
    
    // ==================== Error Messages ====================
    public static final String ERROR_EMPTY_CART = "Không thể tạo đơn hàng rỗng";
    public static final String ERROR_INVALID_STATUS = "Trạng thái đơn hàng không hợp lệ. Phải là: ";
    public static final String ERROR_CANNOT_CANCEL_ORDER = "Không thể hủy đơn hàng với trạng thái: ";
    public static final String ERROR_ACCESS_DENIED = "Bạn chỉ có thể hủy những đơn hàng của mình";
    public static final String ERROR_INVALID_PAYMENT_METHOD = "Phương thức thanh toán không hợp lệ";
    public static final String ERROR_INVALID_PAYMENT_STATUS = "Trạng thái thanh toán không hợp lệ";
    
    private OrderConstants() {
        throw new AssertionError("Cannot instantiate constants class");
    }
}

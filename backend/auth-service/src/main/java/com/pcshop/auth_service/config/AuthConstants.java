package com.pcshop.auth_service.config;

/**
 * Centralized constants for Auth Service.
 */
public final class AuthConstants {
    
    // ==================== OTP Configuration ====================
    public static final long OTP_EXPIRY_MINUTES = 15;
    public static final int OTP_LENGTH = 6;
    public static final int MAX_OTP_ATTEMPTS = 5;
    
    // ==================== Account Status ====================
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_UNVERIFIED = "unverified";
    public static final String STATUS_INACTIVE = "inactive";
    
    // ==================== JWT Claims ====================
    public static final String CLAIM_EMAIL = "email";
    public static final String CLAIM_ROLE = "role";
    
    // ==================== Error Messages ====================
    public static final String ERROR_EMAIL_EXISTS = "Email already exists";
    public static final String ERROR_PHONE_EXISTS = "Phone already exists";
    public static final String ERROR_INVALID_CREDENTIALS = "Invalid email or password";
    public static final String ERROR_ACCOUNT_NOT_VERIFIED = "Account not verified. New OTP has been sent to your email";
    public static final String ERROR_OTP_EXPIRED = "OTP has expired";
    public static final String ERROR_INVALID_OTP = "Invalid OTP code";
    public static final String ERROR_TOO_MANY_ATTEMPTS = "Too many failed attempts. Please request a new OTP";
    public static final String ERROR_INVALID_REFRESH_TOKEN = "Invalid refresh token";
    public static final String ERROR_REFRESH_TOKEN_EXPIRED = "Refresh token has expired";
    public static final String ERROR_ACCOUNT_NOT_FOUND = "Account not found";
    public static final String ERROR_ACCOUNT_ALREADY_VERIFIED = "Account is already verified";
    public static final String ERROR_INVALID_OTP_FORMAT = "Mã OTP phải là 6 chữ số";
    
    private AuthConstants() {
        throw new AssertionError("Cannot instantiate constants class");
    }
}

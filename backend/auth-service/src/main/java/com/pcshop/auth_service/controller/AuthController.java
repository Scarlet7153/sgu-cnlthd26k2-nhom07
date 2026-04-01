package com.pcshop.auth_service.controller;

import com.pcshop.auth_service.dto.request.LoginRequest;
import com.pcshop.auth_service.dto.request.RefreshTokenRequest;
import com.pcshop.auth_service.dto.request.RegisterRequest;
import com.pcshop.auth_service.dto.request.VerifyOtpRequest;
import com.pcshop.auth_service.dto.request.ResendOtpRequest;
import com.pcshop.auth_service.dto.response.ApiResponse;
import com.pcshop.auth_service.dto.response.AuthResponse;
import com.pcshop.auth_service.dto.response.RegisterResponse;
import com.pcshop.auth_service.security.UserPrincipal;
import com.pcshop.auth_service.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Registration successful", response));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        AuthResponse response = authService.verifyOtp(request);
        return ResponseEntity.ok(ApiResponse.ok("OTP verified successfully", response));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<RegisterResponse>> resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        RegisterResponse response = authService.resendOtp(request);
        return ResponseEntity.ok(ApiResponse.ok("OTP resent successfully", response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refresh(request);
        return ResponseEntity.ok(ApiResponse.ok("Token refreshed", response));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@AuthenticationPrincipal UserPrincipal principal) {
        authService.logout(principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Logout successful", null));
    }
}

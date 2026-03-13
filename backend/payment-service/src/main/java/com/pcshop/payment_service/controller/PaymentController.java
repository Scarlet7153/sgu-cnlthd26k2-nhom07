package com.pcshop.payment_service.controller;

import com.pcshop.payment_service.dto.request.InitiatePaymentRequest;
import com.pcshop.payment_service.dto.response.ApiResponse;
import com.pcshop.payment_service.model.Payment;
import com.pcshop.payment_service.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    // ==================== User Endpoints ====================

    @PostMapping("/initiate")
    public ResponseEntity<ApiResponse<Payment>> initiatePayment(
            @RequestHeader("X-User-Id") String accountId,
            @Valid @RequestBody InitiatePaymentRequest request) {
        Payment payment = paymentService.initiatePayment(accountId, request);

        // If MoMo, also create payment URL
        if ("MOMO".equals(request.getMethod())) {
            Map<String, String> momoResult = paymentService.createMomoPaymentUrl(
                    request.getOrderId(), request.getAmount());

            // Return payUrl in response for frontend redirect
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.<Payment>builder()
                            .success(true)
                            .message(momoResult.get("payUrl"))  // payUrl in message field
                            .data(payment)
                            .build());
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Payment initiated", payment));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<ApiResponse<Payment>> getPaymentByOrderId(
            @PathVariable String orderId) {
        Payment payment = paymentService.getPaymentByOrderId(orderId);
        return ResponseEntity.ok(ApiResponse.ok(payment));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Page<Payment>>> getMyPayments(
            @RequestHeader("X-User-Id") String accountId,
            @PageableDefault(size = 10) Pageable pageable) {
        Page<Payment> payments = paymentService.getPaymentsByAccount(accountId, pageable);
        return ResponseEntity.ok(ApiResponse.ok(payments));
    }

    // ==================== MoMo IPN Callback (Public) ====================

    @PostMapping("/callback/momo")
    public ResponseEntity<ApiResponse<Payment>> momoCallback(@RequestBody Map<String, Object> callbackData) {
        Payment payment = paymentService.handleMomoCallback(callbackData);
        return ResponseEntity.ok(ApiResponse.ok("Payment verified", payment));
    }

    // ==================== Admin Endpoints ====================

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Payment>>> getAllPayments(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Payment> payments = paymentService.getAllPayments(pageable);
        return ResponseEntity.ok(ApiResponse.ok(payments));
    }

    @PostMapping("/{orderId}/refund")
    public ResponseEntity<ApiResponse<Payment>> refundPayment(@PathVariable String orderId) {
        Payment payment = paymentService.refundPayment(orderId);
        return ResponseEntity.ok(ApiResponse.ok("Payment refunded", payment));
    }
}

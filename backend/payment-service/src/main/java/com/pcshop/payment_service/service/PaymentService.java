package com.pcshop.payment_service.service;

import com.pcshop.payment_service.client.OrderClient;
import com.pcshop.payment_service.client.UpdateOrderPaymentStatusRequest;
import com.pcshop.payment_service.dto.request.InitiatePaymentRequest;
import com.pcshop.payment_service.exception.BadRequestException;
import com.pcshop.payment_service.exception.ResourceNotFoundException;
import com.pcshop.payment_service.model.Payment;
import com.pcshop.payment_service.model.PaymentLog;
import com.pcshop.payment_service.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final MomoService momoService;
    private final OrderClient orderClient;

    private static final List<String> VALID_METHODS = List.of("MOMO", "COD");

    public Payment initiatePayment(String accountId, InitiatePaymentRequest request) {
        if (!VALID_METHODS.contains(request.getMethod())) {
            throw new BadRequestException("Invalid payment method. Must be one of: " + VALID_METHODS);
        }

        // Check if payment already exists for this order
        paymentRepository.findByOrderId(request.getOrderId()).ifPresent(p -> {
            if (!"failed".equals(p.getStatus())) {
                throw new BadRequestException("Payment already exists for this order with status: " + p.getStatus());
            }
        });

        Payment payment = Payment.builder()
                .orderId(request.getOrderId())
                .accountId(accountId)
                .amount(request.getAmount())
                .method(request.getMethod())
                .build();

        // Handle COD — mark as success immediately
        if ("COD".equals(request.getMethod())) {
            payment.setStatus("success");
            payment.setPaidAt(Instant.now());
            payment.getLogs().add(PaymentLog.builder()
                    .action("cod_confirm")
                    .status("success")
                    .createdAt(Instant.now())
                    .build());

            payment = paymentRepository.save(payment);
            
            // Notify order-service
            UpdateOrderPaymentStatusRequest statusUpdate = new UpdateOrderPaymentStatusRequest();
            statusUpdate.setPaymentStatus("paid");
            orderClient.updatePaymentStatus("system", request.getOrderId(), statusUpdate);

            log.info("COD payment confirmed for order: {}", request.getOrderId());
            return payment;
        }

        // Handle MOMO — create payment URL
        payment.getLogs().add(PaymentLog.builder()
                .action("create_payment_url")
                .status("success")
                .createdAt(Instant.now())
                .build());

        payment = paymentRepository.save(payment);
        log.info("MoMo payment initiated: {} for order: {}", payment.getId(), request.getOrderId());
        return payment;
    }

    /**
     * Create MoMo payment URL and return it.
     */
    public Map<String, String> createMomoPaymentUrl(String orderId, Long amount) {
        String orderInfo = "Thanh toan don hang " + orderId;
        Map<String, String> momoResult = momoService.createPaymentUrl(orderId, amount, orderInfo);

        // Update payment with request data log
        paymentRepository.findByOrderId(orderId).ifPresent(payment -> {
            payment.getLogs().add(PaymentLog.builder()
                    .action("create_payment_url")
                    .status("0".equals(momoResult.get("resultCode")) ? "success" : "failed")
                    .requestData("orderId=" + orderId + "&amount=" + amount)
                    .responseData(momoResult.get("responseBody"))
                    .createdAt(Instant.now())
                    .build());
            paymentRepository.save(payment);
        });

        return momoResult;
    }

    public Payment getPaymentByOrderId(String orderId) {
        return paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", "orderId", orderId));
    }

    public Payment getPaymentById(String paymentId) {
        return paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", "id", paymentId));
    }

    public Page<Payment> getAllPayments(Pageable pageable) {
        return paymentRepository.findAll(pageable);
    }

    public Page<Payment> getPaymentsByAccount(String accountId, Pageable pageable) {
        return paymentRepository.findByAccountId(accountId, pageable);
    }

    /**
     * Handle MoMo IPN callback — verify signature and update payment.
     */
    public Payment handleMomoCallback(Map<String, Object> callbackData) {
        // Verify signature
        boolean isValid = momoService.verifySignature(callbackData);
        if (!isValid) {
            throw new BadRequestException("Invalid MoMo signature");
        }

        String orderId = (String) callbackData.get("orderId");
        String transId = String.valueOf(callbackData.get("transId"));
        Integer resultCode = callbackData.get("resultCode") instanceof Integer
                ? (Integer) callbackData.get("resultCode")
                : Integer.parseInt(String.valueOf(callbackData.get("resultCode")));
        boolean isSuccess = resultCode == 0;

        Payment payment = getPaymentByOrderId(orderId);

        if (!"pending".equals(payment.getStatus())) {
            throw new BadRequestException("Payment is not in pending status");
        }

        payment.setProviderTransactionId(transId);
        payment.setProviderResponse(callbackData.toString());

        if (isSuccess) {
            payment.setStatus("success");
            payment.setPaidAt(Instant.now());
            
            // Notify order-service
            UpdateOrderPaymentStatusRequest statusUpdate = new UpdateOrderPaymentStatusRequest();
            statusUpdate.setPaymentStatus("paid");
            orderClient.updatePaymentStatus("system", orderId, statusUpdate);
        } else {
            payment.setStatus("failed");
        }

        payment.getLogs().add(PaymentLog.builder()
                .action("verify_payment")
                .status(isSuccess ? "success" : "failed")
                .responseData(callbackData.toString())
                .createdAt(Instant.now())
                .build());

        payment = paymentRepository.save(payment);
        log.info("MoMo payment {} verified: {} (resultCode={})", payment.getId(), payment.getStatus(), resultCode);
        return payment;
    }

    /**
     * Admin refund
     */
    public Payment refundPayment(String orderId) {
        Payment payment = getPaymentByOrderId(orderId);

        if (!"success".equals(payment.getStatus())) {
            throw new BadRequestException("Can only refund successful payments");
        }

        payment.setStatus("refunded");
        payment.setRefundedAt(Instant.now());

        payment.getLogs().add(PaymentLog.builder()
                .action("refund")
                .status("success")
                .createdAt(Instant.now())
                .build());

        payment = paymentRepository.save(payment);
        
        // Notify order-service
        UpdateOrderPaymentStatusRequest statusUpdate = new UpdateOrderPaymentStatusRequest();
        statusUpdate.setPaymentStatus("refunded");
        orderClient.updatePaymentStatus("system", orderId, statusUpdate);

        log.info("Payment {} refunded for order: {}", payment.getId(), orderId);
        return payment;
    }
}

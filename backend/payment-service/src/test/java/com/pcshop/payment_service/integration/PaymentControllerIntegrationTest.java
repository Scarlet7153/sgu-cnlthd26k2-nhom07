package com.pcshop.payment_service.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pcshop.payment_service.controller.PaymentController;
import com.pcshop.payment_service.exception.BadRequestException;
import com.pcshop.payment_service.exception.ResourceNotFoundException;
import com.pcshop.payment_service.model.Payment;
import com.pcshop.payment_service.service.PaymentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PaymentController.class)
@AutoConfigureMockMvc(addFilters = false)
class PaymentControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private PaymentService paymentService;

    @Test
    @DisplayName("POST /api/payments/initiate COD → 201")
    void initiateCod() throws Exception {
        Payment p = Payment.builder().id("pay1").orderId("o1").status("success")
                .method("COD").amount(100000L).paidAt(Instant.now()).build();
        when(paymentService.initiatePayment(eq("acc1"), any())).thenReturn(p);

        mockMvc.perform(post("/api/payments/initiate")
                        .header("X-User-Id", "acc1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":\"o1\",\"amount\":100000,\"method\":\"COD\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("success"));
    }

    @Test
    @DisplayName("GET /api/payments/order/{id} → 200")
    void getByOrderId() throws Exception {
        Payment p = Payment.builder().id("pay1").orderId("o1").status("success").build();
        when(paymentService.getPaymentByOrderId("o1")).thenReturn(p);

        mockMvc.perform(get("/api/payments/order/o1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderId").value("o1"));
    }

    @Test
    @DisplayName("GET /api/payments/order/{id} → 404")
    void getByOrderId_notFound() throws Exception {
        when(paymentService.getPaymentByOrderId("x"))
                .thenThrow(new ResourceNotFoundException("Payment", "orderId", "x"));

        mockMvc.perform(get("/api/payments/order/x"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /api/payments/{id}/refund → 200")
    void refund_success() throws Exception {
        Payment p = Payment.builder().id("pay1").orderId("o1").status("refunded")
                .refundedAt(Instant.now()).build();
        when(paymentService.refundPayment("o1")).thenReturn(p);

        mockMvc.perform(post("/api/payments/o1/refund"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("refunded"));
    }

    @Test
    @DisplayName("POST /api/payments/{id}/refund → 400 khi chưa paid")
    void refund_notPaid() throws Exception {
        when(paymentService.refundPayment("o1"))
                .thenThrow(new BadRequestException("Can only refund successful payments"));

        mockMvc.perform(post("/api/payments/o1/refund"))
                .andExpect(status().isBadRequest());
    }
}

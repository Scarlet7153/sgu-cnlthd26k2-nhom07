package com.pcshop.payment_service.unit;

import com.pcshop.payment_service.client.OrderClient;
import com.pcshop.payment_service.dto.request.InitiatePaymentRequest;
import com.pcshop.payment_service.exception.BadRequestException;
import com.pcshop.payment_service.exception.ResourceNotFoundException;
import com.pcshop.payment_service.model.Payment;
import com.pcshop.payment_service.repository.PaymentRepository;
import com.pcshop.payment_service.service.MomoService;
import com.pcshop.payment_service.service.PaymentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepo;
    @Mock private MomoService momoService;
    @Mock private OrderClient orderClient;
    @InjectMocks private PaymentService paymentService;

    @Nested @DisplayName("initiatePayment")
    class Initiate {
        @Test void codSuccess() {
            InitiatePaymentRequest req = new InitiatePaymentRequest();
            req.setOrderId("o1"); req.setAmount(100000L); req.setMethod("COD");
            when(paymentRepo.findByOrderId("o1")).thenReturn(Optional.empty());
            when(paymentRepo.save(any())).thenAnswer(i -> i.getArgument(0));

            Payment p = paymentService.initiatePayment("acc1", req);
            assertThat(p.getStatus()).isEqualTo("success");
            assertThat(p.getPaidAt()).isNotNull();
            verify(orderClient).updatePaymentStatus(eq("system"), eq("o1"), any());
        }
        @Test void invalidMethod() {
            InitiatePaymentRequest req = new InitiatePaymentRequest();
            req.setOrderId("o1"); req.setAmount(100000L); req.setMethod("BITCOIN");
            assertThatThrownBy(() -> paymentService.initiatePayment("acc1", req))
                    .isInstanceOf(BadRequestException.class);
        }
        @Test void alreadyPaid() {
            Payment existing = Payment.builder().orderId("o1").status("success").build();
            when(paymentRepo.findByOrderId("o1")).thenReturn(Optional.of(existing));
            InitiatePaymentRequest req = new InitiatePaymentRequest();
            req.setOrderId("o1"); req.setAmount(100000L); req.setMethod("COD");
            assertThatThrownBy(() -> paymentService.initiatePayment("acc1", req))
                    .isInstanceOf(BadRequestException.class).hasMessageContaining("already completed");
        }
    }

    @Nested @DisplayName("refundPayment")
    class Refund {
        @Test void success() {
            Payment p = Payment.builder().id("p1").orderId("o1").status("success").build();
            when(paymentRepo.findByOrderId("o1")).thenReturn(Optional.of(p));
            when(paymentRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            Payment res = paymentService.refundPayment("o1");
            assertThat(res.getStatus()).isEqualTo("refunded");
            assertThat(res.getRefundedAt()).isNotNull();
        }
        @Test void notSuccess() {
            Payment p = Payment.builder().id("p1").orderId("o1").status("pending").build();
            when(paymentRepo.findByOrderId("o1")).thenReturn(Optional.of(p));
            assertThatThrownBy(() -> paymentService.refundPayment("o1"))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Test void getByOrderIdNotFound() {
        when(paymentRepo.findByOrderId("x")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> paymentService.getPaymentByOrderId("x"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}

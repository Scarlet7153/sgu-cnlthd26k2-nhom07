package com.pcshop.order_service.unit;

import com.pcshop.order_service.config.OrderConstants;
import com.pcshop.order_service.dto.request.CancelOrderRequest;
import com.pcshop.order_service.dto.request.UpdateOrderStatusRequest;
import com.pcshop.order_service.exception.BadRequestException;
import com.pcshop.order_service.exception.ResourceNotFoundException;
import com.pcshop.order_service.mapper.OrderShippingAddressMapper;
import com.pcshop.order_service.model.Order;
import com.pcshop.order_service.model.OrderItem;
import com.pcshop.order_service.repository.OrderRepository;
import com.pcshop.order_service.service.CartService;
import com.pcshop.order_service.service.OrderService;
import com.pcshop.order_service.service.WebSocketNotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepo;
    @Mock private CartService cartService;
    @Mock private OrderShippingAddressMapper addrMapper;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private WebSocketNotificationService wsService;
    @InjectMocks private OrderService orderService;

    private Order pendingOrder() {
        return Order.builder().id("ord-1").accountId("acc-1")
                .status("pending").total(500000L).paymentMethod("COD")
                .items(List.of(OrderItem.builder().productId("p1").productName("CPU").quantity(1).productPrice(500000L).totalPrice(500000L).build()))
                .historyStatus(new ArrayList<>()).build();
    }

    @Nested @DisplayName("updateOrderStatus")
    class UpdateStatus {
        @Test void confirmSuccess() {
            Order o = pendingOrder();
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            when(orderRepo.save(any())).thenAnswer(i -> i.getArgument(0));

            UpdateOrderStatusRequest req = new UpdateOrderStatusRequest();
            req.setStatus("confirmed"); req.setNote("OK");
            Order res = orderService.updateOrderStatus("ord-1", req, "admin");
            assertThat(res.getStatus()).isEqualTo("confirmed");
            assertThat(res.getHistoryStatus()).hasSize(1);
        }

        @Test void invalidStatus() {
            Order o = pendingOrder();
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            UpdateOrderStatusRequest req = new UpdateOrderStatusRequest();
            req.setStatus("invalid_status");
            assertThatThrownBy(() -> orderService.updateOrderStatus("ord-1", req, "admin"))
                    .isInstanceOf(BadRequestException.class);
        }

        @Test void cannotUpdateFinalStatus() {
            Order o = pendingOrder(); o.setStatus("delivered");
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            UpdateOrderStatusRequest req = new UpdateOrderStatusRequest();
            req.setStatus("cancelled");
            assertThatThrownBy(() -> orderService.updateOrderStatus("ord-1", req, "admin"))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested @DisplayName("cancelOrder")
    class Cancel {
        @Test void ownerCancelsPending() {
            Order o = pendingOrder();
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            when(orderRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            CancelOrderRequest req = new CancelOrderRequest();
            req.setCancelReason("Đổi ý");
            Order res = orderService.cancelOrder("ord-1", "acc-1", req);
            assertThat(res.getStatus()).isEqualTo("cancelled");
            assertThat(res.getCancelReason()).isEqualTo("Đổi ý");
        }

        @Test void nonOwnerDenied() {
            Order o = pendingOrder();
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            assertThatThrownBy(() -> orderService.cancelOrder("ord-1", "other-acc", null))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining(OrderConstants.ERROR_ACCESS_DENIED);
        }

        @Test void cannotCancelShipping() {
            Order o = pendingOrder(); o.setStatus("shipping");
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            assertThatThrownBy(() -> orderService.cancelOrder("ord-1", "acc-1", null))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested @DisplayName("updatePaymentStatus")
    class PaymentStatus {
        @Test void markPaid() {
            Order o = pendingOrder();
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            when(orderRepo.save(any())).thenAnswer(i -> i.getArgument(0));
            Order res = orderService.updatePaymentStatus("ord-1", "paid", "system");
            assertThat(res.getPaymentStatus()).isEqualTo("paid");
        }
        @Test void invalidPaymentStatus() {
            Order o = pendingOrder();
            when(orderRepo.findById("ord-1")).thenReturn(Optional.of(o));
            assertThatThrownBy(() -> orderService.updatePaymentStatus("ord-1", "bitcoin", "sys"))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Test void getOrderNotFound() {
        when(orderRepo.findById("x")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> orderService.getOrderById("x"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}

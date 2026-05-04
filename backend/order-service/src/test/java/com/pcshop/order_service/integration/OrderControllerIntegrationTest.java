package com.pcshop.order_service.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pcshop.order_service.controller.OrderController;
import com.pcshop.order_service.exception.BadRequestException;
import com.pcshop.order_service.exception.ResourceNotFoundException;
import com.pcshop.order_service.model.Order;
import com.pcshop.order_service.model.OrderItem;
import com.pcshop.order_service.service.OrderService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderController.class)
@AutoConfigureMockMvc(addFilters = false)
class OrderControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private OrderService orderService;

    private Order sampleOrder() {
        return Order.builder().id("ord-1").accountId("acc-1")
                .status("pending").total(500000L).paymentMethod("COD")
                .items(List.of(OrderItem.builder().productId("p1").productName("CPU")
                        .quantity(1).productPrice(500000L).totalPrice(500000L).build()))
                .historyStatus(new ArrayList<>()).build();
    }

    @Test
    @DisplayName("GET /api/orders/{id} → 200 OK")
    void getById_success() throws Exception {
        when(orderService.getOrderById("ord-1")).thenReturn(sampleOrder());

        mockMvc.perform(get("/api/orders/ord-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("ord-1"))
                .andExpect(jsonPath("$.data.status").value("pending"));
    }

    @Test
    @DisplayName("GET /api/orders/{id} → 404 khi không tìm thấy")
    void getById_notFound() throws Exception {
        when(orderService.getOrderById("x")).thenThrow(new ResourceNotFoundException("Order", "id", "x"));

        mockMvc.perform(get("/api/orders/x"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/orders/me → 200 trả về danh sách đơn hàng")
    void getMyOrders_success() throws Exception {
        when(orderService.getOrdersByAccount(eq("acc-1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(sampleOrder())));

        mockMvc.perform(get("/api/orders/me").header("X-User-Id", "acc-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].id").value("ord-1"));
    }

    @Test
    @DisplayName("PUT /api/orders/{id}/cancel → 200 khi owner cancel pending")
    void cancelOrder_success() throws Exception {
        Order cancelled = sampleOrder();
        cancelled.setStatus("cancelled");
        when(orderService.cancelOrder(eq("ord-1"), eq("acc-1"), any())).thenReturn(cancelled);

        mockMvc.perform(put("/api/orders/ord-1/cancel")
                        .header("X-User-Id", "acc-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cancelReason\":\"Đổi ý\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("cancelled"));
    }

    @Test
    @DisplayName("PUT /api/orders/{id}/cancel → 400 khi không phải owner")
    void cancelOrder_denied() throws Exception {
        when(orderService.cancelOrder(eq("ord-1"), eq("other"), any()))
                .thenThrow(new BadRequestException("Access denied"));

        mockMvc.perform(put("/api/orders/ord-1/cancel")
                        .header("X-User-Id", "other")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/orders/admin → 200 trả về tất cả")
    void adminGetAll() throws Exception {
        when(orderService.getAllOrders(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(sampleOrder())));

        mockMvc.perform(get("/api/orders/admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isArray());
    }
}

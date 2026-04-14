package com.pcshop.order_service.controller;

import com.pcshop.order_service.dto.request.CancelOrderRequest;
import com.pcshop.order_service.dto.request.CreateOrderRequest;
import com.pcshop.order_service.dto.request.UpdateOrderStatusRequest;
import com.pcshop.order_service.dto.response.ApiResponse;
import com.pcshop.order_service.model.Order;
import com.pcshop.order_service.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    // ==================== User Endpoints ====================

    @PostMapping
    public ResponseEntity<ApiResponse<Order>> createOrder(
            @RequestHeader("X-User-Id") String accountId,
            @Valid @RequestBody CreateOrderRequest request) {
        Order order = orderService.createOrder(accountId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Order created", order));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Page<Order>>> getMyOrders(
            @RequestHeader("X-User-Id") String accountId,
            @PageableDefault(size = 10) Pageable pageable) {
        Page<Order> orders = orderService.getOrdersByAccount(accountId, pageable);
        return ResponseEntity.ok(ApiResponse.ok(orders));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Order>> getOrderById(@PathVariable String id) {
        Order order = orderService.getOrderById(id);
        return ResponseEntity.ok(ApiResponse.ok(order));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<Order>> cancelOrder(
            @RequestHeader("X-User-Id") String accountId,
            @PathVariable String id,
            @RequestBody(required = false) CancelOrderRequest request) {
        Order order = orderService.cancelOrder(id, accountId, request);
        return ResponseEntity.ok(ApiResponse.ok("Order cancelled", order));
    }

    // ==================== Admin Endpoints ====================

    @GetMapping("/admin")
    public ResponseEntity<ApiResponse<Page<Order>>> getAllOrders(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Order> orders;
        if (status != null) {
            orders = orderService.getOrdersByStatus(status, pageable);
        } else {
            orders = orderService.getAllOrders(pageable);
        }
        return ResponseEntity.ok(ApiResponse.ok(orders));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<Order>> updateOrderStatus(
            @RequestHeader("X-User-Id") String adminId,
            @PathVariable String id,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        Order order = orderService.updateOrderStatus(id, request, adminId);
        return ResponseEntity.ok(ApiResponse.ok("Status updated", order));
    }
    @PutMapping("/{id}/payment-status")
    public ResponseEntity<ApiResponse<Order>> updatePaymentStatus(
            @RequestHeader(value = "X-User-Id", required = false, defaultValue = "system") String adminId,
            @PathVariable String id,
            @RequestBody com.pcshop.order_service.dto.request.UpdatePaymentStatusRequest request) {
        Order order = orderService.updatePaymentStatus(id, request.getPaymentStatus(), adminId);
        return ResponseEntity.ok(ApiResponse.ok("Payment status updated", order));
    }

    @GetMapping("/admin/stats")
    public ResponseEntity<ApiResponse<com.pcshop.order_service.dto.response.DashboardStatsResponse>> getDashboardStats(
            @RequestParam(defaultValue = "0") long totalUsers,
            @RequestParam(defaultValue = "0") long totalProducts) {
        com.pcshop.order_service.dto.response.DashboardStatsResponse stats =
                orderService.getDashboardStats(totalUsers, totalProducts);
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }
}

package com.pcshop.order_service.service;

import com.pcshop.order_service.dto.request.CancelOrderRequest;
import com.pcshop.order_service.dto.request.CreateOrderRequest;
import com.pcshop.order_service.dto.request.ShippingAddressRequest;
import com.pcshop.order_service.dto.request.UpdateOrderStatusRequest;
import com.pcshop.order_service.exception.BadRequestException;
import com.pcshop.order_service.exception.ResourceNotFoundException;
import com.pcshop.order_service.model.*;
import com.pcshop.order_service.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final CartService cartService;

    private static final List<String> VALID_STATUSES =
            List.of("pending", "confirmed", "shipping", "delivered", "cancelled");

    private static final List<String> VALID_PAYMENT_METHODS =
            List.of("MOMO", "COD");

    public Order createOrder(String accountId, CreateOrderRequest request) {
        // Validate payment method
        if (!VALID_PAYMENT_METHODS.contains(request.getPaymentMethod())) {
            throw new BadRequestException("Invalid payment method. Must be one of: " + VALID_PAYMENT_METHODS);
        }

        List<OrderItem> orderItems;
        boolean usedRedisCart = false;

        // Try Redis cart first, then fall back to request items (FE localStorage cart)
        Cart cart = null;
        try {
            cart = cartService.getCart(accountId);
        } catch (Exception e) {
            log.warn("Could not fetch Redis cart for account {}: {}", accountId, e.getMessage());
        }

        if (cart != null && cart.getItems() != null && !cart.getItems().isEmpty()) {
            // Use Redis cart items
            orderItems = cart.getItems().stream()
                    .map(cartItem -> OrderItem.builder()
                            .productId(cartItem.getProductId())
                            .productName(cartItem.getProductName())
                            .productPrice(cartItem.getPrice())
                            .quantity(cartItem.getQuantity())
                            .totalPrice(cartItem.getPrice() * cartItem.getQuantity())
                            .build())
                    .collect(Collectors.toList());
            usedRedisCart = true;
        } else if (request.getItems() != null && !request.getItems().isEmpty()) {
            // Use items from FE request (client-side cart)
            orderItems = request.getItems().stream()
                    .map(item -> OrderItem.builder()
                            .productId(item.getProductId())
                            .productName(item.getProductName())
                            .productPrice(item.getProductPrice())
                            .quantity(item.getQuantity())
                            .totalPrice(item.getProductPrice() * item.getQuantity())
                            .build())
                    .collect(Collectors.toList());
        } else {
            throw new BadRequestException("Cart is empty and no items provided");
        }

        // Calculate total
        long total = request.getTotalPrice() != null
                ? request.getTotalPrice()
                : orderItems.stream().mapToLong(OrderItem::getTotalPrice).sum();

        // Create order
        Order order = Order.builder()
                .accountId(accountId)
                .paymentMethod(request.getPaymentMethod())
                .items(orderItems)
                .total(total)
                .note(request.getNote())
                .shippingAddress(request.getShippingAddress() != null
                        ? toShippingAddress(request.getShippingAddress())
                        : null)
                .build();

        // Add initial status history
        order.getHistoryStatus().add(StatusHistory.builder()
                .status("pending")
                .note("Order created")
                .changeBy("system")
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);

        // Clear Redis cart if it was used
        if (usedRedisCart) {
            cartService.clearCart(accountId);
        }

        log.info("Order created: {} for account: {}", order.getId(), accountId);
        return order;
    }

    private ShippingAddress toShippingAddress(ShippingAddressRequest req) {
        ShippingAddress addr = new ShippingAddress();
        addr.setFullName(req.getFullName());
        addr.setPhone(req.getPhone());
        addr.setEmail(req.getEmail());
        addr.setAddress(req.getAddress());
        return addr;
    }

    public Order getOrderById(String orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", "id", orderId));
    }

    public Page<Order> getOrdersByAccount(String accountId, Pageable pageable) {
        return orderRepository.findByAccountId(accountId, pageable);
    }

    public Page<Order> getAllOrders(Pageable pageable) {
        return orderRepository.findAll(pageable);
    }

    public Page<Order> getOrdersByStatus(String status, Pageable pageable) {
        return orderRepository.findByStatus(status, pageable);
    }

    public Order updateOrderStatus(String orderId, UpdateOrderStatusRequest request, String changedBy) {
        Order order = getOrderById(orderId);

        if (!VALID_STATUSES.contains(request.getStatus())) {
            throw new BadRequestException("Invalid status. Must be one of: " + VALID_STATUSES);
        }

        if ("cancelled".equals(order.getStatus()) || "delivered".equals(order.getStatus())) {
            throw new BadRequestException("Cannot update status of " + order.getStatus() + " order");
        }

        order.setStatus(request.getStatus());
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(request.getStatus())
                .note(request.getNote())
                .changeBy(changedBy)
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);
        log.info("Order {} status updated to {}", orderId, request.getStatus());
        return order;
    }

    public Order cancelOrder(String orderId, String accountId, CancelOrderRequest request) {
        Order order = getOrderById(orderId);

        // Only the owner can cancel
        if (!order.getAccountId().equals(accountId)) {
            throw new BadRequestException("You can only cancel your own orders");
        }

        // Can only cancel pending or confirmed orders
        if (!"pending".equals(order.getStatus()) && !"confirmed".equals(order.getStatus())) {
            throw new BadRequestException("Cannot cancel order with status: " + order.getStatus());
        }

        order.setStatus("cancelled");
        order.setCancelReason(request != null ? request.getCancelReason() : null);
        order.getHistoryStatus().add(StatusHistory.builder()
                .status("cancelled")
                .note(request != null ? request.getCancelReason() : "Cancelled by user")
                .changeBy(accountId)
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);
        log.info("Order {} cancelled by {}", orderId, accountId);
        return order;
    }

    public Order updatePaymentStatus(String orderId, String paymentStatus, String changedBy) {
        Order order = getOrderById(orderId);

        if (!List.of("unpaid", "paid", "refunded").contains(paymentStatus)) {
            throw new BadRequestException("Invalid payment status");
        }

        order.setPaymentStatus(paymentStatus);
        
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(order.getStatus()) // keeping same order status
                .note("Payment status updated to: " + paymentStatus)
                .changeBy(changedBy)
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);
        log.info("Order {} payment status updated to {}", orderId, paymentStatus);
        return order;
    }
}

package com.pcshop.order_service.service;

import com.pcshop.order_service.config.OrderConstants;
import com.pcshop.order_service.dto.request.CancelOrderRequest;
import com.pcshop.order_service.dto.request.CreateOrderRequest;
import com.pcshop.order_service.dto.request.ShippingAddressRequest;
import com.pcshop.order_service.dto.request.UpdateOrderStatusRequest;
import com.pcshop.order_service.dto.response.DashboardStatsResponse;
import com.pcshop.order_service.exception.BadRequestException;
import com.pcshop.order_service.exception.ResourceNotFoundException;
import com.pcshop.order_service.mapper.OrderShippingAddressMapper;
import com.pcshop.order_service.model.*;
import com.pcshop.order_service.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final CartService cartService;
    private final OrderShippingAddressMapper shippingAddressMapper;
    private final MongoTemplate mongoTemplate;
    private final WebSocketNotificationService webSocketNotificationService;

    public Order createOrder(String accountId, CreateOrderRequest request) {
        // Validate payment method
        if (!OrderConstants.VALID_PAYMENT_METHODS.contains(request.getPaymentMethod())) {
            throw new BadRequestException(OrderConstants.ERROR_INVALID_PAYMENT_METHOD + OrderConstants.VALID_PAYMENT_METHODS);
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
                            .productImage(cartItem.getProductImage())
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
                            .productImage(item.getProductImage())
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
                            .productImage(item.getProductImage())
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
                .shippingAddress(shippingAddressMapper.toEntity(request.getShippingAddress()))
                .build();

        // Add initial status history
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_PENDING)
                .note("Tạo đơn hàng")
                .changeBy("system")
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);

        // Clear Redis cart if it was used
        if (usedRedisCart) {
            cartService.clearCart(accountId);
        }

        // Send WebSocket notification for new order
        webSocketNotificationService.broadcastNewOrderNotification(
                order.getId(),
                accountId,
                "New Customer", // TODO: Get customer name from user-service
                order.getTotal(),
                order.getPaymentMethod()
        );

        log.info("Order created: {} for account: {}", order.getId(), accountId);
        return order;
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
        String oldStatus = order.getStatus();

        if (!OrderConstants.VALID_STATUSES.contains(request.getStatus())) {
            throw new BadRequestException(OrderConstants.ERROR_INVALID_STATUS + OrderConstants.VALID_STATUSES);
        }

        if (OrderConstants.FINAL_STATUSES.contains(oldStatus)) {
            throw new BadRequestException(OrderConstants.ERROR_CANNOT_CANCEL_ORDER + oldStatus);
        }

        order.setStatus(request.getStatus());
        String note = request.getNote();
        if (note == null || note.isBlank()) {
            note = switch (request.getStatus()) {
                case "confirmed" -> "Đã xác nhận đơn hàng";
                case "shipping" -> "Đang giao hàng";
                case "delivered" -> "Đã giao hàng thành công";
                case "cancelled" -> "Đã hủy đơn hàng";
                default -> "Cập nhật trạng thái: " + request.getStatus();
            };
        }
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(request.getStatus())
                .note(note)
                .changeBy(changedBy)
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);

        // Send WebSocket notification for status update
        webSocketNotificationService.sendOrderStatusUpdate(
                order.getAccountId(),
                orderId,
                oldStatus,
                request.getStatus(),
                note
        );

        log.info("Order {} status updated from {} to {}", orderId, oldStatus, request.getStatus());
        return order;
    }

    public Order cancelOrder(String orderId, String accountId, CancelOrderRequest request) {
        Order order = getOrderById(orderId);

        // Only the owner can cancel
        if (!order.getAccountId().equals(accountId)) {
            throw new BadRequestException(OrderConstants.ERROR_ACCESS_DENIED);
        }

        // Can only cancel pending or confirmed orders
        if (!OrderConstants.STATUS_PENDING.equals(order.getStatus()) && !OrderConstants.STATUS_CONFIRMED.equals(order.getStatus())) {
            throw new BadRequestException(OrderConstants.ERROR_CANNOT_CANCEL_ORDER + order.getStatus());
        }

        order.setStatus(OrderConstants.STATUS_CANCELLED);
        order.setCancelReason(request != null ? request.getCancelReason() : null);
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_CANCELLED)
                .note(request != null ? request.getCancelReason() : "Đã hủy bởi người dùng")
                .changeBy(accountId)
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);
        log.info("Order {} cancelled by {}", orderId, accountId);
        return order;
    }

    public Order updatePaymentStatus(String orderId, String paymentStatus, String changedBy) {
        Order order = getOrderById(orderId);
        String oldPaymentStatus = order.getPaymentStatus();

        if (!OrderConstants.VALID_PAYMENT_STATUSES.contains(paymentStatus)) {
            throw new BadRequestException(OrderConstants.ERROR_INVALID_PAYMENT_STATUS);
        }

        order.setPaymentStatus(paymentStatus);
        
        String paymentStatusKey = "payment_" + paymentStatus;
        String paymentNote = switch (paymentStatus) {
            case "paid" -> "Đã thanh toán";
            case "refunded" -> "Đã hoàn tiền";
            default -> "Chưa thanh toán";
        };
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(paymentStatusKey)
                .note(paymentNote)
                .changeBy(changedBy)
                .createdAt(Instant.now())
                .build());

        order = orderRepository.save(order);

        // Send WebSocket notification for payment status update
        webSocketNotificationService.sendPaymentStatusUpdate(
                order.getAccountId(),
                orderId,
                paymentStatus,
                order.getPaymentMethod(),
                order.getTotal(),
                paymentNote
        );

        log.info("Order {} payment status updated from {} to {}", orderId, oldPaymentStatus, paymentStatus);
        return order;
    }

    public DashboardStatsResponse getDashboardStats(long totalUsers, long totalProducts) {
        List<Order> allOrders = orderRepository.findAll();

        long totalOrders = allOrders.size();
        long totalRevenue = allOrders.stream()
                .filter(o -> !OrderConstants.STATUS_CANCELLED.equals(o.getStatus()))
                .mapToLong(Order::getTotal)
                .sum();

        Map<String, Long> ordersByStatus = allOrders.stream()
                .collect(Collectors.groupingBy(Order::getStatus, Collectors.counting()));

        Map<String, Long> revenueByStatus = allOrders.stream()
                .filter(o -> !OrderConstants.STATUS_CANCELLED.equals(o.getStatus()))
                .collect(Collectors.groupingBy(Order::getStatus, Collectors.summingLong(Order::getTotal)));

        Map<String, Long> ordersByPaymentMethod = allOrders.stream()
                .collect(Collectors.groupingBy(
                        o -> o.getPaymentMethod() != null ? o.getPaymentMethod() : "UNKNOWN",
                        Collectors.counting()));

        List<DashboardStatsResponse.DailyStats> dailyRevenue = getDailyRevenueStats(allOrders);

        List<DashboardStatsResponse.TopProduct> topProducts = getTopProducts(allOrders);

        Map<String, Double> orderStatusPercentages = ordersByStatus.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> totalOrders > 0 ? (e.getValue() * 100.0 / totalOrders) : 0.0));

        long averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        long cancelledOrders = ordersByStatus.getOrDefault(OrderConstants.STATUS_CANCELLED, 0L);
        double cancelRate = totalOrders > 0 ? (cancelledOrders * 100.0 / totalOrders) : 0.0;

        return DashboardStatsResponse.builder()
                .totalOrders(totalOrders)
                .totalRevenue(totalRevenue)
                .totalUsers(totalUsers)
                .totalProducts(totalProducts)
                .ordersByStatus(ordersByStatus)
                .revenueByStatus(revenueByStatus)
                .ordersByPaymentMethod(ordersByPaymentMethod)
                .dailyRevenue(dailyRevenue)
                .topProducts(topProducts)
                .orderStatusPercentages(orderStatusPercentages)
                .averageOrderValue(averageOrderValue)
                .cancelRate(cancelRate)
                .build();
    }

    private List<DashboardStatsResponse.DailyStats> getDailyRevenueStats(List<Order> allOrders) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM");
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);

        Map<String, DashboardStatsResponse.DailyStats> dailyMap = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            String key = date.format(formatter);
            dailyMap.put(key, DashboardStatsResponse.DailyStats.builder()
                    .date(key)
                    .revenue(0)
                    .orderCount(0)
                    .build());
        }

        Instant sevenDaysAgo = Instant.now().minusSeconds(7L * 24 * 3600);

        for (Order order : allOrders) {
            if (order.getCreatedAt() != null && order.getCreatedAt().isAfter(sevenDaysAgo)
                    && !OrderConstants.STATUS_CANCELLED.equals(order.getStatus())) {
                String dateKey = order.getCreatedAt().atZone(zone).toLocalDate().format(formatter);
                DashboardStatsResponse.DailyStats ds = dailyMap.get(dateKey);
                if (ds != null) {
                    ds.setRevenue(ds.getRevenue() + order.getTotal());
                    ds.setOrderCount(ds.getOrderCount() + 1);
                }
            }
        }

        return new ArrayList<>(dailyMap.values());
    }

    private List<DashboardStatsResponse.TopProduct> getTopProducts(List<Order> allOrders) {
        Map<String, long[]> productStats = new HashMap<>();

        for (Order order : allOrders) {
            if (OrderConstants.STATUS_CANCELLED.equals(order.getStatus())
                    || order.getItems() == null) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                String key = item.getProductId() + "|" + item.getProductName();
                productStats.computeIfAbsent(key, k -> new long[2]);
                productStats.get(key)[0] += item.getQuantity();
                productStats.get(key)[1] += item.getTotalPrice();
            }
        }

        return productStats.entrySet().stream()
                .map(e -> {
                    String[] parts = e.getKey().split("\\|", 2);
                    return DashboardStatsResponse.TopProduct.builder()
                            .productId(parts[0])
                            .productName(parts.length > 1 ? parts[1] : "Unknown")
                            .totalQuantity(e.getValue()[0])
                            .totalRevenue(e.getValue()[1])
                            .build();
                })
                .sorted((a, b) -> Long.compare(b.getTotalQuantity(), a.getTotalQuantity()))
                .limit(5)
                .collect(Collectors.toList());
    }
}

package com.pcshop.order_service.util;

import com.pcshop.order_service.dto.request.CancelOrderRequest;
import com.pcshop.order_service.dto.request.CreateOrderRequest;

import com.pcshop.order_service.dto.request.ShippingAddressRequest;
import com.pcshop.order_service.dto.request.UpdateOrderStatusRequest;
import com.pcshop.order_service.model.Cart;
import com.pcshop.order_service.model.CartItem;
import com.pcshop.order_service.model.Order;
import com.pcshop.order_service.model.OrderItem;
import com.pcshop.order_service.model.ShippingAddress;
import com.pcshop.order_service.model.StatusHistory;
import com.pcshop.order_service.config.OrderConstants;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * TestDataFactory - Utility class for creating test data objects.
 * Centralizes test data creation to ensure consistency across tests.
 * 
 * Following Factory Pattern for test object creation
 */
public class TestDataFactory {

    // ==================== Default Test IDs ====================
    public static final String DEFAULT_ACCOUNT_ID = "acc-12345";
    public static final String DEFAULT_ORDER_ID = "order-67890";
    public static final String DEFAULT_PRODUCT_ID = "prod-11111";
    public static final String DEFAULT_PRODUCT_ID_2 = "prod-22222";
    public static final String DEFAULT_ADMIN_ID = "admin-99999";

    // ==================== Default Test Values ====================
    public static final String DEFAULT_PRODUCT_NAME = "Gaming Laptop RTX 4060";
    public static final String DEFAULT_PRODUCT_NAME_2 = "Wireless Mouse Logitech";
    public static final Long DEFAULT_PRODUCT_PRICE = 25_000_000L;
    public static final Long DEFAULT_PRODUCT_PRICE_2 = 850_000L;
    public static final Integer DEFAULT_QUANTITY = 1;
    public static final Integer DEFAULT_QUANTITY_2 = 2;
    public static final String DEFAULT_PRODUCT_IMAGE = "https://example.com/laptop.jpg";
    public static final String DEFAULT_PRODUCT_IMAGE_2 = "https://example.com/mouse.jpg";

    // Private constructor to prevent instantiation
    private TestDataFactory() {
        throw new AssertionError("Cannot instantiate TestDataFactory");
    }

    /**
     * Creates a test Order object with default values.
     * Status: pending, PaymentStatus: unpaid
     * 
     * @return Order object with default test data
     */
    public static Order createTestOrder() {
        List<OrderItem> items = Arrays.asList(
                createTestOrderItem(),
                createTestOrderItem2()
        );

        List<StatusHistory> history = new ArrayList<>();
        history.add(StatusHistory.builder()
                .status(OrderConstants.STATUS_PENDING)
                .note("Tạo đơn hàng")
                .changeBy("system")
                .createdAt(Instant.now())
                .build());

        return Order.builder()
                .id(DEFAULT_ORDER_ID)
                .accountId(DEFAULT_ACCOUNT_ID)
                .status(OrderConstants.STATUS_PENDING)
                .paymentMethod(OrderConstants.METHOD_COD)
                .paymentStatus(OrderConstants.PAYMENT_STATUS_UNPAID)
                .items(items)
                .total(calculateTotal(items))
                .note("Test order note")
                .shippingAddress(createTestShippingAddress())
                .historyStatus(history)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    /**
     * Creates a test Order object with custom status.
     * 
     * @param status The order status to set
     * @return Order object with specified status
     */
    public static Order createTestOrderWithStatus(String status) {
        Order order = createTestOrder();
        order.setStatus(status);
        return order;
    }

    /**
     * Creates a confirmed order for testing status transitions.
     * 
     * @return Order object with confirmed status
     */
    public static Order createConfirmedOrder() {
        Order order = createTestOrder();
        order.setStatus(OrderConstants.STATUS_CONFIRMED);
        
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_CONFIRMED)
                .note("Đã xác nhận đơn hàng")
                .changeBy(DEFAULT_ADMIN_ID)
                .createdAt(Instant.now())
                .build());
        
        return order;
    }

    /**
     * Creates a delivered order for testing final status scenarios.
     * 
     * @return Order object with delivered status
     */
    public static Order createDeliveredOrder() {
        Order order = createTestOrder();
        order.setStatus(OrderConstants.STATUS_DELIVERED);
        order.setPaymentStatus(OrderConstants.PAYMENT_STATUS_PAID);
        
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_CONFIRMED)
                .note("Đã xác nhận đơn hàng")
                .changeBy(DEFAULT_ADMIN_ID)
                .createdAt(Instant.now().minusSeconds(3600))
                .build());
        
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_SHIPPING)
                .note("Đang giao hàng")
                .changeBy(DEFAULT_ADMIN_ID)
                .createdAt(Instant.now().minusSeconds(1800))
                .build());
        
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_DELIVERED)
                .note("Đã giao hàng thành công")
                .changeBy(DEFAULT_ADMIN_ID)
                .createdAt(Instant.now())
                .build());
        
        return order;
    }

    /**
     * Creates a cancelled order for testing cancel scenarios.
     * 
     * @return Order object with cancelled status
     */
    public static Order createCancelledOrder() {
        Order order = createTestOrder();
        order.setStatus(OrderConstants.STATUS_CANCELLED);
        order.setCancelReason("Customer changed mind");
        
        order.getHistoryStatus().add(StatusHistory.builder()
                .status(OrderConstants.STATUS_CANCELLED)
                .note("Customer changed mind")
                .changeBy(DEFAULT_ACCOUNT_ID)
                .createdAt(Instant.now())
                .build());
        
        return order;
    }

    /**
     * Creates the first test OrderItem.
     * 
     * @return OrderItem with default gaming laptop data
     */
    public static OrderItem createTestOrderItem() {
        return OrderItem.builder()
                .productId(DEFAULT_PRODUCT_ID)
                .productName(DEFAULT_PRODUCT_NAME)
                .productPrice(DEFAULT_PRODUCT_PRICE)
                .quantity(DEFAULT_QUANTITY)
                .totalPrice(DEFAULT_PRODUCT_PRICE * DEFAULT_QUANTITY)
                .productImage(DEFAULT_PRODUCT_IMAGE)
                .warrantyMonths(24)
                .build();
    }

    /**
     * Creates the second test OrderItem.
     * 
     * @return OrderItem with default mouse data
     */
    public static OrderItem createTestOrderItem2() {
        return OrderItem.builder()
                .productId(DEFAULT_PRODUCT_ID_2)
                .productName(DEFAULT_PRODUCT_NAME_2)
                .productPrice(DEFAULT_PRODUCT_PRICE_2)
                .quantity(DEFAULT_QUANTITY_2)
                .totalPrice(DEFAULT_PRODUCT_PRICE_2 * DEFAULT_QUANTITY_2)
                .productImage(DEFAULT_PRODUCT_IMAGE_2)
                .warrantyMonths(12)
                .build();
    }

    /**
     * Creates a test ShippingAddress.
     * 
     * @return ShippingAddress with default test data
     */
    public static ShippingAddress createTestShippingAddress() {
        ShippingAddress address = new ShippingAddress();
        address.setFullName("Nguyen Van Test");
        address.setPhone("0909123456");
        address.setEmail("test@example.com");
        address.setAddress("123 Test Street, District 1, Ho Chi Minh City");
        return address;
    }

    /**
     * Creates a test CreateOrderRequest with COD payment method.
     * 
     * @return CreateOrderRequest with default test data
     */
    public static CreateOrderRequest createTestOrderRequest() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setPaymentMethod(OrderConstants.METHOD_COD);
        request.setNote("Please deliver during office hours");
        request.setItems(Arrays.asList(
                createTestOrderItemRequest(),
                createTestOrderItemRequest2()
        ));
        request.setShippingAddress(createTestShippingAddressRequest());
        request.setTotalPrice(26_700_000L); // Sum of items
        return request;
    }

    /**
     * Creates a test CreateOrderRequest with MOMO payment method.
     * 
     * @return CreateOrderRequest with MOMO payment
     */
    public static CreateOrderRequest createTestOrderRequestWithMomo() {
        CreateOrderRequest request = createTestOrderRequest();
        request.setPaymentMethod(OrderConstants.METHOD_MOMO);
        return request;
    }

    /**
     * Creates a test CreateOrderRequest with invalid payment method.
     * Used for testing validation errors.
     * 
     * @return CreateOrderRequest with invalid payment
     */
    public static CreateOrderRequest createTestOrderRequestWithInvalidPayment() {
        CreateOrderRequest request = createTestOrderRequest();
        request.setPaymentMethod("INVALID_PAYMENT");
        return request;
    }

    /**
     * Creates a test CreateOrderRequest with empty items.
     * Used for testing empty cart scenarios.
     * 
     * @return CreateOrderRequest with empty items list
     */
    public static CreateOrderRequest createTestOrderRequestWithEmptyItems() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setPaymentMethod(OrderConstants.METHOD_COD);
        request.setItems(new ArrayList<>());
        request.setShippingAddress(createTestShippingAddressRequest());
        return request;
    }

    /**
     * Creates the first test OrderItemRequest.
     * 
     * @return OrderItemRequest for gaming laptop
     */
    public static CreateOrderRequest.OrderItemRequest createTestOrderItemRequest() {
        CreateOrderRequest.OrderItemRequest item = new CreateOrderRequest.OrderItemRequest();
        item.setProductId(DEFAULT_PRODUCT_ID);
        item.setProductName(DEFAULT_PRODUCT_NAME);
        item.setProductPrice(DEFAULT_PRODUCT_PRICE);
        item.setQuantity(DEFAULT_QUANTITY);
        item.setProductImage(DEFAULT_PRODUCT_IMAGE);
        return item;
    }

    /**
     * Creates the second test OrderItemRequest.
     * 
     * @return OrderItemRequest for mouse
     */
    public static CreateOrderRequest.OrderItemRequest createTestOrderItemRequest2() {
        CreateOrderRequest.OrderItemRequest item = new CreateOrderRequest.OrderItemRequest();
        item.setProductId(DEFAULT_PRODUCT_ID_2);
        item.setProductName(DEFAULT_PRODUCT_NAME_2);
        item.setProductPrice(DEFAULT_PRODUCT_PRICE_2);
        item.setQuantity(DEFAULT_QUANTITY_2);
        item.setProductImage(DEFAULT_PRODUCT_IMAGE_2);
        return item;
    }

    /**
     * Creates a test ShippingAddressRequest.
     * 
     * @return ShippingAddressRequest with default test data
     */
    public static ShippingAddressRequest createTestShippingAddressRequest() {
        ShippingAddressRequest address = new ShippingAddressRequest();
        address.setFullName("Nguyen Van Test");
        address.setPhone("0909123456");
        address.setEmail("test@example.com");
        address.setAddress("123 Test Street, District 1, Ho Chi Minh City");
        return address;
    }

    /**
     * Creates a test UpdateOrderStatusRequest for confirming order.
     * 
     * @return UpdateOrderStatusRequest with confirmed status
     */
    public static UpdateOrderStatusRequest createConfirmStatusRequest() {
        UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
        request.setStatus(OrderConstants.STATUS_CONFIRMED);
        request.setNote("Order confirmed by admin");
        return request;
    }

    /**
     * Creates a test UpdateOrderStatusRequest for shipping order.
     * 
     * @return UpdateOrderStatusRequest with shipping status
     */
    public static UpdateOrderStatusRequest createShippingStatusRequest() {
        UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
        request.setStatus(OrderConstants.STATUS_SHIPPING);
        return request;
    }

    /**
     * Creates a test UpdateOrderStatusRequest for delivering order.
     * 
     * @return UpdateOrderStatusRequest with delivered status
     */
    public static UpdateOrderStatusRequest createDeliveredStatusRequest() {
        UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
        request.setStatus(OrderConstants.STATUS_DELIVERED);
        return request;
    }

    /**
     * Creates a test UpdateOrderStatusRequest with invalid status.
     * Used for testing validation errors.
     * 
     * @return UpdateOrderStatusRequest with invalid status
     */
    public static UpdateOrderStatusRequest createInvalidStatusRequest() {
        UpdateOrderStatusRequest request = new UpdateOrderStatusRequest();
        request.setStatus("INVALID_STATUS");
        return request;
    }

    /**
     * Creates a test CancelOrderRequest.
     * 
     * @return CancelOrderRequest with default cancel reason
     */
    public static CancelOrderRequest createTestCancelRequest() {
        CancelOrderRequest request = new CancelOrderRequest();
        request.setCancelReason("Customer changed mind");
        return request;
    }

    /**
     * Creates a test CancelOrderRequest with null reason.
     * 
     * @return CancelOrderRequest with null cancel reason
     */
    public static CancelOrderRequest createCancelRequestWithNullReason() {
        CancelOrderRequest request = new CancelOrderRequest();
        request.setCancelReason(null);
        return request;
    }

    /**
     * Creates a test Cart with items.
     * 
     * @return Cart object with default items
     */
    public static Cart createTestCart() {
        return Cart.builder()
                .items(Arrays.asList(
                        createTestCartItem(),
                        createTestCartItem2()
                ))
                .updatedAt(Instant.now())
                .build();
    }

    /**
     * Creates an empty test Cart.
     * 
     * @return Cart object with empty items list
     */
    public static Cart createEmptyTestCart() {
        return Cart.builder()
                .items(new ArrayList<>())
                .updatedAt(Instant.now())
                .build();
    }

    /**
     * Creates the first test CartItem.
     * 
     * @return CartItem for gaming laptop
     */
    public static CartItem createTestCartItem() {
        return CartItem.builder()
                .productId(DEFAULT_PRODUCT_ID)
                .productName(DEFAULT_PRODUCT_NAME)
                .price(DEFAULT_PRODUCT_PRICE)
                .quantity(DEFAULT_QUANTITY)
                .productImage(DEFAULT_PRODUCT_IMAGE)
                .build();
    }

    /**
     * Creates the second test CartItem.
     * 
     * @return CartItem for mouse
     */
    public static CartItem createTestCartItem2() {
        return CartItem.builder()
                .productId(DEFAULT_PRODUCT_ID_2)
                .productName(DEFAULT_PRODUCT_NAME_2)
                .price(DEFAULT_PRODUCT_PRICE_2)
                .quantity(DEFAULT_QUANTITY_2)
                .productImage(DEFAULT_PRODUCT_IMAGE_2)
                .build();
    }

    /**
     * Creates a list of test Orders for pagination testing.
     * 
     * @param count Number of orders to create
     * @return List of Order objects
     */
    public static List<Order> createTestOrders(int count) {
        List<Order> orders = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Order order = createTestOrder();
            order.setId(DEFAULT_ORDER_ID + "-" + i);
            order.setAccountId(DEFAULT_ACCOUNT_ID + "-" + (i % 3)); // Distribute among 3 accounts
            orders.add(order);
        }
        return orders;
    }

    // ==================== Helper Methods ====================

    /**
     * Calculates the total price from a list of order items.
     * 
     * @param items List of OrderItem
     * @return Total price sum
     */
    private static long calculateTotal(List<OrderItem> items) {
        return items.stream()
                .mapToLong(OrderItem::getTotalPrice)
                .sum();
    }
}

package com.pcshop.order_service.service;

import com.pcshop.order_service.dto.websocket.NewOrderNotificationMessage;
import com.pcshop.order_service.dto.websocket.OrderStatusUpdateMessage;
import com.pcshop.order_service.dto.websocket.PaymentStatusUpdateMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Send order status update to specific user
     */
    public void sendOrderStatusUpdate(String accountId, String orderId, String oldStatus, String newStatus, String message) {
        try {
            OrderStatusUpdateMessage updateMessage = OrderStatusUpdateMessage.builder()
                    .orderId(orderId)
                    .accountId(accountId)
                    .oldStatus(oldStatus)
                    .newStatus(newStatus)
                    .message(message)
                    .timestamp(Instant.now())
                    .build();

            // Send to user-specific queue
            String destination = "/queue/order-status";
            messagingTemplate.convertAndSendToUser(accountId, destination, updateMessage);
            
            log.info("Sent order status update to user {} for order {}: {} -> {}", 
                    accountId, orderId, oldStatus, newStatus);
        } catch (Exception e) {
            log.error("Failed to send order status update: {}", e.getMessage());
        }
    }

    /**
     * Send payment status update to specific user
     */
    public void sendPaymentStatusUpdate(String accountId, String orderId, String paymentStatus, 
                                       String paymentMethod, Long amount, String message) {
        try {
            PaymentStatusUpdateMessage updateMessage = PaymentStatusUpdateMessage.builder()
                    .orderId(orderId)
                    .accountId(accountId)
                    .paymentStatus(paymentStatus)
                    .paymentMethod(paymentMethod)
                    .amount(amount)
                    .message(message)
                    .timestamp(Instant.now())
                    .build();

            String destination = "/queue/payment-status";
            messagingTemplate.convertAndSendToUser(accountId, destination, updateMessage);
            
            log.info("Sent payment status update to user {} for order {}: {}", 
                    accountId, orderId, paymentStatus);
        } catch (Exception e) {
            log.error("Failed to send payment status update: {}", e.getMessage());
        }
    }

    /**
     * Broadcast new order notification to all admin users
     */
    public void broadcastNewOrderNotification(String orderId, String accountId, String customerName, 
                                             Long total, String paymentMethod) {
        try {
            NewOrderNotificationMessage notification = NewOrderNotificationMessage.builder()
                    .orderId(orderId)
                    .accountId(accountId)
                    .customerName(customerName)
                    .total(total)
                    .paymentMethod(paymentMethod)
                    .timestamp(Instant.now())
                    .build();

            // Broadcast to topic for admins
            messagingTemplate.convertAndSend("/topic/admin/new-orders", notification);
            
            log.info("Broadcasted new order notification for order {}", orderId);
        } catch (Exception e) {
            log.error("Failed to broadcast new order notification: {}", e.getMessage());
        }
    }

    /**
     * Send notification to specific user (generic)
     */
    public void sendNotificationToUser(String accountId, String destination, Object payload) {
        try {
            messagingTemplate.convertAndSendToUser(accountId, destination, payload);
            log.debug("Sent notification to user {} at {}", accountId, destination);
        } catch (Exception e) {
            log.error("Failed to send notification to user: {}", e.getMessage());
        }
    }

    /**
     * Broadcast message to all connected users
     */
    public void broadcastToAll(String destination, Object payload) {
        try {
            messagingTemplate.convertAndSend(destination, payload);
            log.debug("Broadcasted message to all at {}", destination);
        } catch (Exception e) {
            log.error("Failed to broadcast message: {}", e.getMessage());
        }
    }
}

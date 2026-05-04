# WebSocket Real-time Notifications

Hệ thống WebSocket cung cấp real-time notifications cho các sự kiện quan trọng trong TMĐT.

## 🎯 Tính năng

- **Order Status Updates**: Thông báo khi trạng thái đơn hàng thay đổi
- **Payment Status Updates**: Thông báo khi trạng thái thanh toán cập nhật
- **Admin Notifications**: Thông báo đơn hàng mới cho admin
- **JWT Authentication**: Xác thực qua JWT token
- **Auto Reconnect**: Tự động kết nối lại khi mất kết nối

## 🏗️ Kiến trúc

```
┌─────────────┐      WebSocket       ┌──────────────┐
│   React     │ ◄──────────────────► │Order Service │
│  (STOMP)    │    /ws/notifications │  (Port 8083) │
└─────────────┘                      └──────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │  STOMP Broker   │
                                   │ (In-memory)     │
                                   └─────────────────┘
```

## 📁 Cấu trúc file

### Backend (order-service)
```
websocket/
├── WebSocketConfig.java              # Configuration
├── WebSocketAuthInterceptor.java     # JWT authentication
└── WebSocketController.java          # Message handlers

dto/websocket/
├── OrderStatusUpdateMessage.java
├── PaymentStatusUpdateMessage.java
├── NewOrderNotificationMessage.java
└── WebSocketConnectMessage.java

service/
└── WebSocketNotificationService.java # Send notifications
```

### Frontend
```
types/websocket.types.ts              # TypeScript types
hooks/
└── useWebSocket.ts                   # WebSocket hook
components/
└── WebSocketNotifications.tsx        # Toast notifications
```

## 🔌 WebSocket Endpoints

### Connection
- **URL**: `ws://localhost:8083/ws/notifications`
- **Protocol**: STOMP over SockJS

### Subscribe Destinations

| Destination | Mô tả | Ngườii dùng |
|------------|-------|------------|
| `/user/queue/order-status` | Order status updates | Customer |
| `/user/queue/payment-status` | Payment status updates | Customer |
| `/topic/admin/new-orders` | New order notifications | Admin |
| `/user/queue/connect` | Connection confirmation | All |

### Send Destinations

| Destination | Mô tả |
|------------|-------|
| `/app/connect` | Kết nối và xác thực |
| `/app/ping` | Ping server |

## 🚀 Cách sử dụng

### 1. Hook trong Component

```tsx
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect } from 'react';

function MyComponent() {
  const { subscribeToOrderUpdates, connected } = useWebSocket();

  useEffect(() => {
    if (!connected) return;

    const unsubscribe = subscribeToOrderUpdates((message) => {
      console.log('Order updated:', message);
      // Handle notification
    });

    return () => unsubscribe();
  }, [connected, subscribeToOrderUpdates]);

  return <div>{connected ? 'Connected' : 'Disconnected'}</div>;
}
```

### 2. Gửi Notification từ Backend

```java
@Autowired
private WebSocketNotificationService notificationService;

// Trong service method
notificationService.sendOrderStatusUpdate(
    accountId,
    orderId,
    oldStatus,
    newStatus,
    message
);
```

## ⚙️ Configuration

### Backend (application.yaml)
```yaml
jwt:
  secret: ${JWT_SECRET:your-secret-key}
```

### Frontend (.env)
```
VITE_WS_URL=http://localhost:8083
```

## 🔐 Authentication

WebSocket sử dụng JWT token trong header `Authorization`:

```javascript
connectHeaders: {
  Authorization: `Bearer ${accessToken}`
}
```

Token được xác thực trong `WebSocketAuthInterceptor`.

## 📊 Message Formats

### Order Status Update
```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "accountId": "507f1f77bcf86cd799439012",
  "oldStatus": "pending",
  "newStatus": "confirmed",
  "message": "Đã xác nhận đơn hàng",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Payment Status Update
```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "accountId": "507f1f77bcf86cd799439012",
  "paymentStatus": "paid",
  "paymentMethod": "MOMO",
  "amount": 1500000,
  "message": "Đã thanh toán",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### New Order (Admin)
```json
{
  "orderId": "507f1f77bcf86cd799439011",
  "accountId": "507f1f77bcf86cd799439012",
  "customerName": "Nguyễn Văn A",
  "total": 1500000,
  "paymentMethod": "MOMO",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔄 Auto Reconnect

- **Delay**: 5 giây
- **Heartbeat**: 4 giây (incoming/outgoing)
- **Max retries**: Không giới hạn

## 🧪 Testing

### Backend Test
```bash
# Start order-service
./mvnw spring-boot:run -pl order-service

# Test WebSocket endpoint
curl http://localhost:8083/ws/notifications
```

### Frontend Test
1. Login vào hệ thống
2. Mở trang đơn hàng
3. Từ Admin dashboard, cập nhật trạng thái đơn hàng
4. Quan sát toast notification hiện lên

## 🐛 Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|-----|------------|----------|
| Connection refused | Service chưa chạy | Start order-service |
| Authentication failed | Token hết hạn | Login lại |
| No notifications | Chưa subscribe | Kiểm tra useEffect |
| 404 Not Found | Sai endpoint | Kiểm tra URL |

## 📚 Dependencies

### Backend
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### Frontend
```bash
npm install @stomp/stompjs sockjs-client
npm install --save-dev @types/sockjs-client
```

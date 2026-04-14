// WebSocket Message Types

export interface OrderStatusUpdateMessage {
  orderId: string;
  accountId: string;
  oldStatus: string;
  newStatus: string;
  message: string;
  timestamp: string;
}

export interface PaymentStatusUpdateMessage {
  orderId: string;
  accountId: string;
  paymentStatus: 'paid' | 'unpaid' | 'refunded';
  paymentMethod: string;
  amount: number;
  message: string;
  timestamp: string;
}

export interface NewOrderNotificationMessage {
  orderId: string;
  accountId: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  timestamp: string;
}

export interface WebSocketConnectMessage {
  type: string;
  message: string;
  userId: string;
}

export type WebSocketMessage = 
  | OrderStatusUpdateMessage 
  | PaymentStatusUpdateMessage 
  | NewOrderNotificationMessage 
  | WebSocketConnectMessage;

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export type WebSocketCallback<T = WebSocketMessage> = (message: T) => void;

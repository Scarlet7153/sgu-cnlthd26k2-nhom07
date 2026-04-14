import { useEffect, useRef, useState, useCallback } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '@/context/AuthContext';
import { 
  WebSocketState, 
  WebSocketCallback, 
  OrderStatusUpdateMessage,
  PaymentStatusUpdateMessage,
  NewOrderNotificationMessage 
} from '@/types/websocket.types';

const WS_ENDPOINT = '/ws/notifications';
// Use relative path for dev (vite proxy), full URL for production
const WS_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_WS_URL || 'http://localhost:8083');

export function useWebSocket() {
  const { user, getAccessToken } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (clientRef.current?.active || !user) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setState(prev => ({ ...prev, error: 'No access token available' }));
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    const client = new Client({
      webSocketFactory: () => new SockJS(`${WS_BASE_URL}${WS_ENDPOINT}`),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        if (import.meta.env.DEV) {
          console.log('[WebSocket]', str);
        }
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      console.log('[WebSocket] Connected');
      setState({
        connected: true,
        connecting: false,
        error: null,
      });
      
      // Send connect message
      client.publish({
        destination: '/app/connect',
        body: JSON.stringify({ type: 'CONNECT' }),
      });
    };

    client.onDisconnect = () => {
      console.log('[WebSocket] Disconnected');
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
      }));
    };

    client.onStompError = (frame) => {
      console.error('[WebSocket] Error:', frame.headers.message);
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: frame.headers.message || 'WebSocket error',
      }));
    };

    client.activate();
    clientRef.current = client;
  }, [user, getAccessToken]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    subscriptionsRef.current.forEach((subscription) => {
      subscription.unsubscribe();
    });
    subscriptionsRef.current.clear();
    
    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
    }
    
    setState({
      connected: false,
      connecting: false,
      error: null,
    });
  }, []);

  // Subscribe to a destination
  const subscribe = useCallback(<T,>(
    destination: string,
    callback: WebSocketCallback<T>
  ): (() => void) => {
    if (!clientRef.current?.active) {
      console.warn('[WebSocket] Cannot subscribe, client not connected');
      return () => {};
    }

    // Convert user-specific destinations
    const fullDestination = destination.startsWith('/user/')
      ? destination
      : destination;

    const subscription = clientRef.current.subscribe(
      fullDestination,
      (message: IMessage) => {
        try {
          const body = JSON.parse(message.body);
          callback(body as T);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      }
    );

    subscriptionsRef.current.set(destination, subscription);
    
    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
      subscriptionsRef.current.delete(destination);
    };
  }, []);

  // Subscribe to order status updates
  const subscribeToOrderUpdates = useCallback((
    callback: WebSocketCallback<OrderStatusUpdateMessage>
  ): (() => void) => {
    return subscribe('/user/queue/order-status', callback);
  }, [subscribe]);

  // Subscribe to payment status updates
  const subscribeToPaymentUpdates = useCallback((
    callback: WebSocketCallback<PaymentStatusUpdateMessage>
  ): (() => void) => {
    return subscribe('/user/queue/payment-status', callback);
  }, [subscribe]);

  // Subscribe to admin new orders (admin only)
  const subscribeToAdminNewOrders = useCallback((
    callback: WebSocketCallback<NewOrderNotificationMessage>
  ): (() => void) => {
    return subscribe('/topic/admin/new-orders', callback);
  }, [subscribe]);

  // Send ping to keep connection alive
  const ping = useCallback(() => {
    if (clientRef.current?.active) {
      clientRef.current.publish({
        destination: '/app/ping',
        body: JSON.stringify({ timestamp: Date.now() }),
      });
    }
  }, []);

  // Auto-connect when user is authenticated
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    subscribeToOrderUpdates,
    subscribeToPaymentUpdates,
    subscribeToAdminNewOrders,
    ping,
  };
}

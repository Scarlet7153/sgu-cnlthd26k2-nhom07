import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import { Package, CreditCard, ShoppingCart } from 'lucide-react';

export function WebSocketNotifications() {
  const { 
    connected, 
    subscribeToOrderUpdates, 
    subscribeToPaymentUpdates,
    subscribeToAdminNewOrders 
  } = useWebSocket();

  useEffect(() => {
    if (!connected) return;

    // Subscribe to order status updates
    const unsubscribeOrder = subscribeToOrderUpdates((message) => {
      const statusLabels: Record<string, string> = {
        pending: 'Chờ xác nhận',
        confirmed: 'Đã xác nhận',
        shipping: 'Đang giao',
        delivered: 'Đã giao',
        cancelled: 'Đã hủy',
      };

      toast.info(
        <div className="flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            Cập nhật đơn hàng
          </div>
          <div className="text-sm">
            Đơn hàng <span className="font-mono text-xs">#{message.orderId.slice(-8)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Trạng thái: {statusLabels[message.newStatus] || message.newStatus}
          </div>
          {message.message && (
            <div className="text-xs text-muted-foreground">{message.message}</div>
          )}
        </div>,
        { duration: 5000 }
      );
    });

    // Subscribe to payment status updates
    const unsubscribePayment = subscribeToPaymentUpdates((message) => {
      const paymentLabels: Record<string, string> = {
        paid: 'Đã thanh toán',
        unpaid: 'Chưa thanh toán',
        refunded: 'Đã hoàn tiền',
      };

      const isPaid = message.paymentStatus === 'paid';
      
      toast[message.paymentStatus === 'refunded' ? 'warning' : isPaid ? 'success' : 'info'](
        <div className="flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Cập nhật thanh toán
          </div>
          <div className="text-sm">
            Đơn hàng <span className="font-mono text-xs">#{message.orderId.slice(-8)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {paymentLabels[message.paymentStatus] || message.paymentStatus}
            {message.amount && ` - ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(message.amount)}`}
          </div>
        </div>,
        { duration: 5000 }
      );
    });

    return () => {
      unsubscribeOrder();
      unsubscribePayment();
    };
  }, [connected, subscribeToOrderUpdates, subscribeToPaymentUpdates]);

  // Admin notifications
  useEffect(() => {
    if (!connected) return;

    // Check if user is admin
    const isAdmin = localStorage.getItem('auth-user')?.includes('"role":"ADMIN"');
    if (!isAdmin) return;

    const unsubscribeAdmin = subscribeToAdminNewOrders((message) => {
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="font-semibold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Đơn hàng mới!
          </div>
          <div className="text-sm">
            Khách hàng: {message.customerName}
          </div>
          <div className="text-sm text-muted-foreground">
            Tổng tiền: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(message.total)}
          </div>
          <div className="text-xs text-muted-foreground">
            Phương thức: {message.paymentMethod}
          </div>
        </div>,
        { duration: 8000 }
      );
    });

    return () => {
      unsubscribeAdmin();
    };
  }, [connected, subscribeToAdminNewOrders]);

  return null; // This is a logic-only component
}

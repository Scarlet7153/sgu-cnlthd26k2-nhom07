import { useEffect, useState, useCallback } from "react";
import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";
import { useAuth } from "@/context/AuthContext";
import { CartItem } from "@/types/product.types";

export type OrderStatus = "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";

export interface OrderAddress {
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  note?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  totalPrice: number;
  warrantyMonths?: number;
}

export interface Order {
  id: string;
  accountId?: string;
  items: OrderItem[];
  shippingAddress?: OrderAddress;
  paymentMethod: string; // "COD", "MOMO", "VNPAY", "BANK_TRANSFER"
  paymentStatus?: "unpaid" | "paid" | "refunded";
  status: OrderStatus;
  total: number;
  note?: string;
  cancelReason?: string;
  historyStatus?: Array<{
    status: string;
    note?: string;
    changeBy?: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

interface CreateOrderData {
  items: CartItem[];
  address?: OrderAddress;
  shippingAddress?: OrderAddress;
  paymentMethod: "cod" | "momo";
  totalPrice: number;
  note?: string;
}

interface OrdersResponse {
  content?: Order[];
  data?: Order[];
  orders?: Order[];
}

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's orders
  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get(`/orders/me`);
      const data = unwrapApiData<OrdersResponse>(response);

      // Handle different response formats
      const ordersList = data?.content || data?.data || data?.orders || [];
      setOrders(Array.isArray(ordersList) ? ordersList : []);
    } catch (err) {
      const message = getApiErrorMessage(err, "Lỗi khi lấy danh sách đơn hàng");
      setError(message);
      console.error("Fetch orders error:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-fetch orders when user changes
  useEffect(() => {
    if (user?.id) {
      fetchOrders();
    }
  }, [user?.id, fetchOrders]);

  // Get order detail
  const getOrder = useCallback(
    async (orderId: string): Promise<Order | null> => {
      if (!user?.id) return null;

      setLoading(true);
      setError(null);
      try {
        const response = await axiosClient.get(`/orders/${orderId}`);
        const order = unwrapApiData<Order>(response);
        return order || null;
      } catch (err) {
        const message = getApiErrorMessage(err, "Lỗi khi lấy chi tiết đơn hàng");
        setError(message);
        console.error("Get order error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Create new order
  const createOrder = useCallback(
    async (orderData: CreateOrderData): Promise<Order | null> => {
      if (!user?.id) return null;

      setLoading(true);
      setError(null);
      try {
        // Backend expects minimal CreateOrderRequest { paymentMethod, note }
        // Map frontend paymentMethod to backend accepted values
        let paymentMethod = orderData.paymentMethod;
        let mappedPaymentMethod = paymentMethod === "cod" ? "COD" : paymentMethod === "momo" ? "MOMO" : (paymentMethod || "").toString().toUpperCase();

        const payload = {
          paymentMethod: mappedPaymentMethod,
          note: orderData.note || "",
          // Send items and shippingAddress so backend can create order without Redis
          items: orderData.items.map(i => ({ 
            productId: i.productId || i.product?.id || i.product.id, 
            quantity: i.quantity, 
            productName: i.product?.name || i.productName, 
            productPrice: i.price || i.product?.price,
            productImage: i.product?.image || i.image || i.productImage // Send image snapshot
          })),
          shippingAddress: orderData.shippingAddress || orderData.address,
          totalPrice: orderData.totalPrice,
        };

        const response = await axiosClient.post(`/orders`, payload);
        const newOrder = unwrapApiData<Order>(response);
        if (newOrder) {
          setOrders((prev) => [newOrder, ...prev]);
        }
        return newOrder || null;
      } catch (err) {
        const message = getApiErrorMessage(err, "Lỗi khi tạo đơn hàng");
        setError(message);
        console.error("Create order error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Cancel order
  const cancelOrder = useCallback(
    async (orderId: string): Promise<boolean> => {
      if (!user?.id) return false;

      setLoading(true);
      setError(null);
      try {
        await axiosClient.put(`/orders/${orderId}/cancel`);
        // Update local state
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: "cancelled" as OrderStatus } : order
          )
        );
        return true;
      } catch (err) {
        const message = getApiErrorMessage(err, "Lỗi khi hủy đơn hàng");
        setError(message);
        console.error("Cancel order error:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Retry MoMo payment
  const retryPayment = useCallback(
    async (orderId: string, amount: number): Promise<string | null> => {
      if (!user?.id) {
        console.error("Cannot retry payment: user ID not available");
        throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      }

      setError(null);
      try {
        const payload = {
          orderId,
          amount: Math.round(amount), // Convert to integer (Long in Java)
          method: "MOMO",
        };
        
        console.log("Retrying payment with payload:", payload);
        console.log("User ID:", user.id);
        
        const response = await axiosClient.post(`/payments/initiate`, payload);
        
        // axiosClient unwraps response to response.data (ApiResponse)
        // response = { success, message: payUrl, data: Payment }
        console.log("Payment API response:", response);
        
        const payUrl = response?.message;
        if (payUrl && payUrl.startsWith("http")) {
          return payUrl;
        } else {
          console.warn("Invalid or missing payUrl:", payUrl);
          throw new Error(`Không nhận được đường dẫn thanh toán: ${payUrl || "null"}`);
        }
      } catch (err) {
        const message = getApiErrorMessage(err, "Lỗi khi khởi tạo thanh toán lại");
        setError(message);
        console.error("Retry payment error:", err);
        throw err; // Re-throw to be caught by component
      }
    },
    [user?.id]
  );

  return {
    orders,
    loading,
    error,
    fetchOrders,
    getOrder,
    createOrder,
    cancelOrder,
    retryPayment,
  };
}

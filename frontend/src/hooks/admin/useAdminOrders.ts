import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosClient, { getApiErrorMessage, unwrapApiData } from "@/lib/axiosClient";

export type AdminOrderStatus = "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";

export interface AdminOrderItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  totalPrice: number;
  productImage?: string;
}

export interface AdminOrderAddress {
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
  note?: string;
}

export interface AdminOrder {
  id: string;
  accountId?: string;
  items: AdminOrderItem[];
  shippingAddress?: AdminOrderAddress;
  paymentMethod: string;
  paymentStatus?: "unpaid" | "paid" | "refunded";
  status: AdminOrderStatus;
  total: number;
  totalPrice?: number;
  note?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateOrderStatusRequest {
  status: AdminOrderStatus;
  note?: string;
}

export function useAdminOrders({
  page = 0,
  size = 20,
  status,
}: {
  page?: number;
  size?: number;
  status?: string;
} = {}) {
  return useQuery({
    queryKey: ["admin-orders", { page, size, status }],
    queryFn: async () => {
      try {
        let endpoint = `/orders/admin?page=${page}&size=${size}`;
        if (status && status !== "all") {
          endpoint += `&status=${status}`;
        }

        const res: any = await axiosClient.get(endpoint);
        const data = unwrapApiData(res) || {};
        return {
          content: data?.content || data?.data || data?.orders || [],
          totalElements: data?.totalElements || 0,
          totalPages: data?.totalPages || 1,
          number: data?.number || 0,
        };
      } catch (err) {
        console.error("Fetch orders error:", getApiErrorMessage(err));
        return { content: [], totalElements: 0, totalPages: 1, number: 0 };
      }
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateOrderStatusRequest }) => {
      const res: any = await axiosClient.put(`/orders/${id}/status`, data);
      return unwrapApiData<AdminOrder>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, paymentStatus }: { id: string; paymentStatus: string }) => {
      const res: any = await axiosClient.put(`/orders/${id}/payment-status`, { paymentStatus });
      return unwrapApiData<AdminOrder>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
}

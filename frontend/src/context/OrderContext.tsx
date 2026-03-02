import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from "react";
import { CartItem } from "@/types/product.types";

export interface OrderAddress {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}

export type OrderStatus = "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";

export interface Order {
  id: string;
  items: CartItem[];
  address: OrderAddress;
  paymentMethod: "cod" | "banking";
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
}

type OrderAction =
  | { type: "LOAD_ORDERS"; orders: Order[] }
  | { type: "ADD_ORDER"; order: Order }
  | { type: "UPDATE_STATUS"; orderId: string; status: OrderStatus };

interface OrderState {
  orders: Order[];
}

interface OrderContextValue {
  orders: Order[];
  addOrder: (order: Omit<Order, "id" | "createdAt" | "status">) => string;
  getOrder: (id: string) => Order | undefined;
  getUserOrders: (userId: string) => Order[];
}

const OrderContext = createContext<OrderContextValue | null>(null);

function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case "LOAD_ORDERS":
      return { orders: action.orders };
    case "ADD_ORDER":
      return { orders: [action.order, ...state.orders] };
    case "UPDATE_STATUS":
      return {
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, status: action.status } : o
        ),
      };
    default:
      return state;
  }
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, { orders: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pc-store-orders");
      if (saved) {
        dispatch({ type: "LOAD_ORDERS", orders: JSON.parse(saved) as Order[] });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pc-store-orders", JSON.stringify(state.orders));
  }, [state.orders]);

  const addOrder = useCallback(
    (orderData: Omit<Order, "id" | "createdAt" | "status">) => {
      const id = crypto.randomUUID();
      const order: Order = {
        ...orderData,
        id,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_ORDER", order });
      return id;
    },
    []
  );

  const getOrder = useCallback(
    (id: string) => state.orders.find((o) => o.id === id),
    [state.orders]
  );

  const getUserOrders = useCallback(
    (_userId: string) => state.orders,
    [state.orders]
  );

  const value = useMemo<OrderContextValue>(
    () => ({ orders: state.orders, addOrder, getOrder, getUserOrders }),
    [state.orders, addOrder, getOrder, getUserOrders]
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
}

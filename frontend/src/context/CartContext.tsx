import React, { createContext, useReducer, useEffect, useCallback, useMemo } from "react";
import { CartItem, Product } from "@/types/product.types";

type CartAction =
  | { type: "ADD_TO_CART"; product: Product; quantity?: number }
  | { type: "REMOVE_FROM_CART"; productId: string }
  | { type: "UPDATE_QUANTITY"; productId: string; quantity: number }
  | { type: "CLEAR_CART" }
  | { type: "LOAD_CART"; items: CartItem[] };

interface CartState {
  items: CartItem[];
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
}

export const CartContext = createContext<CartContextValue | null>(null);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_TO_CART": {
      const existing = state.items.find((i) => i.product.id === action.product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === action.product.id
              ? { ...i, quantity: i.quantity + (action.quantity ?? 1) }
              : i
          ),
        };
      }
      return { items: [...state.items, { product: action.product, quantity: action.quantity ?? 1 }] };
    }
    case "REMOVE_FROM_CART":
      return { items: state.items.filter((i) => i.product.id !== action.productId) };
    case "UPDATE_QUANTITY":
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.product.id !== action.productId) };
      }
      return {
        items: state.items.map((i) =>
          i.product.id === action.productId ? { ...i, quantity: action.quantity } : i
        ),
      };
    case "CLEAR_CART":
      return { items: [] };
    case "LOAD_CART":
      return { items: action.items };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pc-store-cart");
      if (saved) {
        dispatch({ type: "LOAD_CART", items: JSON.parse(saved) as CartItem[] });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("pc-store-cart", JSON.stringify(state.items));
  }, [state.items]);

  const addToCart = useCallback((product: Product, quantity?: number) => {
    dispatch({ type: "ADD_TO_CART", product, quantity });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    dispatch({ type: "REMOVE_FROM_CART", productId });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", productId, quantity });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  const getItemQuantity = useCallback(
    (productId: string) => state.items.find((i) => i.product.id === productId)?.quantity ?? 0,
    [state.items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      totalItems: state.items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getItemQuantity,
    }),
    [state.items, addToCart, removeFromCart, updateQuantity, clearCart, getItemQuantity]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

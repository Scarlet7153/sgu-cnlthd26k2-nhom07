import React, { createContext, useReducer, useEffect, useCallback, useMemo } from "react";
import { Product } from "@/types/product.types";

type WishlistAction =
  | { type: "ADD"; product: Product }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" }
  | { type: "LOAD"; items: Product[] };

interface WishlistState {
  items: Product[];
}

interface WishlistContextValue {
  items: Product[];
  totalItems: number;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (product: Product) => void;
}

export const WishlistContext = createContext<WishlistContextValue | null>(null);

function wishlistReducer(state: WishlistState, action: WishlistAction): WishlistState {
  switch (action.type) {
    case "ADD": {
      if (state.items.some((i) => i.id === action.product.id)) return state;
      return { items: [...state.items, action.product] };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.id !== action.productId) };
    case "CLEAR":
      return { items: [] };
    case "LOAD":
      return { items: action.items };
    default:
      return state;
  }
}

const STORAGE_KEY = "pc-store-wishlist";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wishlistReducer, { items: [] });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        dispatch({ type: "LOAD", items: JSON.parse(saved) as Product[] });
      }
    } catch { /* ignore */ }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const addToWishlist = useCallback((product: Product) => {
    dispatch({ type: "ADD", product });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    dispatch({ type: "REMOVE", productId });
  }, []);

  const clearWishlist = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => state.items.some((i) => i.id === productId),
    [state.items]
  );

  const toggleWishlist = useCallback(
    (product: Product) => {
      if (state.items.some((i) => i.id === product.id)) {
        dispatch({ type: "REMOVE", productId: product.id });
      } else {
        dispatch({ type: "ADD", product });
      }
    },
    [state.items]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      items: state.items,
      totalItems: state.items.length,
      addToWishlist,
      removeFromWishlist,
      clearWishlist,
      isInWishlist,
      toggleWishlist,
    }),
    [state.items, addToWishlist, removeFromWishlist, clearWishlist, isInWishlist, toggleWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

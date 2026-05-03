"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Service } from "@/lib/types";

export interface CartServiceSnapshot {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  image?: string;
  categoryName?: string;
}

export interface CartItem {
  id: string;
  service: CartServiceSnapshot;
}

export interface PendingCheckoutSession {
  paymentOrderId: string;
  cartItemIds: string[];
  createdAt: number;
}

interface CartState {
  items: CartItem[];
  pendingCheckout: PendingCheckoutSession | null;
  addItem: (service: Service | CartServiceSnapshot) => CartItem;
  removeItem: (itemId: string) => void;
  removeItems: (itemIds: string[]) => void;
  clearCart: () => void;
  startPendingCheckout: (paymentOrderId: string, cartItemIds: string[]) => void;
  completePendingCheckout: (paymentOrderId: string) => void;
  clearPendingCheckout: (paymentOrderId?: string) => void;
}

function createCartItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toCartServiceSnapshot(service: Service | CartServiceSnapshot): CartServiceSnapshot {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    duration: service.duration,
    price: service.price,
    image: service.image,
    categoryName:
      "category" in service
        ? service.category?.name
        : service.categoryName,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      pendingCheckout: null,
      addItem: (service) => {
        const item = {
          id: createCartItemId(),
          service: toCartServiceSnapshot(service),
        };

        set((state) => ({ items: [...state.items, item] }));
        return item;
      },
      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
        }));
      },
      removeItems: (itemIds) => {
        const idsToRemove = new Set(itemIds);
        set((state) => ({
          items: state.items.filter((item) => !idsToRemove.has(item.id)),
        }));
      },
      clearCart: () => set({ items: [], pendingCheckout: null }),
      startPendingCheckout: (paymentOrderId, cartItemIds) => {
        const uniqueCartItemIds = [...new Set(cartItemIds)];
        set({
          pendingCheckout: {
            paymentOrderId,
            cartItemIds: uniqueCartItemIds,
            createdAt: Date.now(),
          },
        });
      },
      completePendingCheckout: (paymentOrderId) => {
        set((state) => {
          if (state.pendingCheckout?.paymentOrderId !== paymentOrderId) {
            return {};
          }

          const pendingCartItemIds = new Set(state.pendingCheckout.cartItemIds);
          return {
            items: state.items.filter((item) => !pendingCartItemIds.has(item.id)),
            pendingCheckout: null,
          };
        });
      },
      clearPendingCheckout: (paymentOrderId) => {
        set((state) => {
          if (
            paymentOrderId &&
            state.pendingCheckout?.paymentOrderId !== paymentOrderId
          ) {
            return {};
          }

          return { pendingCheckout: null };
        });
      },
    }),
    {
      name: "kalanara-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        pendingCheckout: state.pendingCheckout,
      }),
    }
  )
);

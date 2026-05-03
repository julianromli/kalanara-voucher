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

interface CartState {
  items: CartItem[];
  addItem: (service: Service | CartServiceSnapshot) => CartItem;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
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
      "categoryName" in service
        ? service.categoryName
        : service.category?.name,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
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
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "kalanara-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);

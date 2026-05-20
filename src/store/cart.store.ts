import * as Crypto from "expo-crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CartItem } from "@/types";

import { asyncStorageAdapter } from "./_storage";
import { useMenuStore } from "./menu.store";

export type AddCartItemInput = {
  productId?: string;
  accompagnementId?: string;
  variantId?: string;
  quantity: number;
  supplements: string[];
  notes?: string;
};

type CartState = {
  items: CartItem[];
  addItem: (input: AddCartItemInput) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateSupplements: (itemId: string, supplements: string[]) => void;
  clearCart: () => void;
  totalEUR: () => number;
  itemCount: () => number;
};

/**
 * Unit price for a single cart-line: product variant (or base) + supplements,
 * or the flat price of an accompagnement.
 * Uses the menu store for live catalogue data.
 */
export function getLineUnitPrice(item: CartItem): number {
  const menuState = useMenuStore.getState();

  if (item.accompagnementId) {
    const acc = menuState.accompagnements.find(
      (a) => a.id === item.accompagnementId,
    );
    return acc ? Number(acc.price_eur) : 0;
  }

  if (!item.productId) return 0;
  const product = menuState.getProductById(item.productId);
  if (!product) return 0;

  const basePrice =
    item.variantId !== undefined && product.product_variants?.length > 0
      ? (product.product_variants.find((v) => v.id === item.variantId)
          ?.price_eur ?? product.price_eur)
      : product.price_eur;

  const supplementsTotal = item.supplements.reduce((acc, id) => {
    const supplement = menuState.getSupplementById(id);
    return acc + (supplement?.price_eur ?? 0);
  }, 0);

  return basePrice + supplementsTotal;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: ({
        productId,
        accompagnementId,
        variantId,
        quantity,
        supplements,
        notes,
      }) => {
        const newItem: CartItem = {
          id: Crypto.randomUUID(),
          productId,
          accompagnementId,
          variantId,
          quantity: Math.max(1, quantity),
          supplements,
          notes,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      removeItem: (itemId) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
      },

      updateQuantity: (itemId, quantity) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, quantity: Math.max(1, quantity) } : i,
          ),
        }));
      },

      updateSupplements: (itemId, supplements) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, supplements } : i,
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      totalEUR: () => {
        return get().items.reduce(
          (sum, item) => sum + getLineUnitPrice(item) * item.quantity,
          0,
        );
      },

      itemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: "pops.cart.v1",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

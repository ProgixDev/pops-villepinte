import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { favoritesApi } from "@/lib/api";

import { asyncStorageAdapter } from "./_storage";

type FavoritesState = {
  productIds: string[];
  loading: boolean;
  fetch: () => Promise<void>;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  clear: () => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      productIds: [],
      loading: false,

      fetch: async () => {
        set({ loading: true });
        try {
          const ids = await favoritesApi.list();
          set({ productIds: ids, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      isFavorite: (productId: string) =>
        get().productIds.includes(productId),

      toggle: async (productId: string) => {
        const wasFavorite = get().productIds.includes(productId);
        // Optimistic
        set((s) => ({
          productIds: wasFavorite
            ? s.productIds.filter((id) => id !== productId)
            : [productId, ...s.productIds],
        }));
        try {
          if (wasFavorite) {
            await favoritesApi.remove(productId);
          } else {
            await favoritesApi.add(productId);
          }
        } catch {
          // Reconcile with server on failure
          void get().fetch();
        }
      },

      clear: () => {
        set({ productIds: [] });
      },
    }),
    {
      name: "pops.favorites.v1",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (s) => ({ productIds: s.productIds }),
    },
  ),
);

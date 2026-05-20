import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { menuApi } from "@/lib/api";
import type {
  Accompagnement,
  Category,
  Product,
  Supplement,
} from "@/types";

import { asyncStorageAdapter } from "./_storage";

type MenuState = {
  categories: Category[];
  products: Product[];
  supplements: Supplement[];
  signatures: Product[];
  advice: Product[];
  accompagnements: Accompagnement[];
  loading: boolean;
  error: string | null;
  fetchMenu: () => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getSupplementById: (id: string) => Supplement | undefined;
  getProductsByCategory: (categoryId: string) => Product[];
  searchProducts: (query: string) => Product[];
};

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      categories: [],
      products: [],
      supplements: [],
      signatures: [],
      advice: [],
      accompagnements: [],
      loading: false,
      error: null,

      fetchMenu: async () => {
        set({ loading: true, error: null });
        try {
          const [
            categories,
            products,
            supplements,
            signaturesResult,
            adviceResult,
            accompagnementsResult,
          ] = await Promise.all([
            menuApi.getCategories(),
            menuApi.getProducts(),
            menuApi.getSupplements(),
            menuApi.getSignatures().catch(() => [] as unknown[]),
            menuApi.getAdvice().catch(() => [] as unknown[]),
            menuApi.getAccompagnements().catch(() => [] as unknown[]),
          ]);
          set({
            categories: categories as unknown as Category[],
            products: products as unknown as Product[],
            supplements: supplements as unknown as Supplement[],
            signatures: signaturesResult as unknown as Product[],
            advice: adviceResult as unknown as Product[],
            accompagnements: accompagnementsResult as unknown as Accompagnement[],
            loading: false,
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Failed to load menu";
          set({ error: message, loading: false });
        }
      },

      getProductById: (id: string) => {
        return get().products.find((p) => p.id === id);
      },

      getSupplementById: (id: string) => {
        return get().supplements.find((s) => s.id === id);
      },

      getProductsByCategory: (categoryId: string) => {
        return get().products.filter((p) => p.category_id === categoryId);
      },

      searchProducts: (query: string) => {
        const q = query.toLowerCase().trim();
        if (!q) return get().products;
        return get().products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description?.toLowerCase().includes(q) ?? false),
        );
      },
    }),
    {
      name: "pops.menu.v1",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (s) => ({
        categories: s.categories,
        products: s.products,
        supplements: s.supplements,
        signatures: s.signatures,
        advice: s.advice,
        accompagnements: s.accompagnements,
      }),
      version: 2,
    },
  ),
);

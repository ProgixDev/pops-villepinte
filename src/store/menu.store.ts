import { create } from "zustand";

import { menuApi } from "@/lib/api";
import type { Category, Product, Supplement } from "@/types";

type MenuState = {
  categories: Category[];
  products: Product[];
  supplements: Supplement[];
  signatures: Product[];
  advice: Product[];
  loading: boolean;
  error: string | null;
  fetchMenu: () => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getSupplementById: (id: string) => Supplement | undefined;
  getProductsByCategory: (categoryId: string) => Product[];
  searchProducts: (query: string) => Product[];
};

export const useMenuStore = create<MenuState>()((set, get) => ({
  categories: [],
  products: [],
  supplements: [],
  signatures: [],
  advice: [],
  loading: false,
  error: null,

  fetchMenu: async () => {
    set({ loading: true, error: null });
    try {
      const [categories, products, supplements, signaturesResult, adviceResult] =
        await Promise.all([
          menuApi.getCategories(),
          menuApi.getProducts(),
          menuApi.getSupplements(),
          menuApi.getSignatures().catch(() => [] as unknown[]),
          menuApi.getAdvice().catch(() => [] as unknown[]),
        ]);
      set({
        categories: categories as unknown as Category[],
        products: products as unknown as Product[],
        supplements: supplements as unknown as Supplement[],
        signatures: signaturesResult as unknown as Product[],
        advice: adviceResult as unknown as Product[],
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
}));

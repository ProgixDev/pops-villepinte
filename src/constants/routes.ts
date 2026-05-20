/**
 * Centralized expo-router paths. Use these instead of hardcoded strings so
 * route renames stay typo-proof and become single-edit refactors.
 */

export const ROUTES = {
  home: "/" as const,
  menu: "/menu" as const,
  orders: "/orders" as const,
  cart: "/cart" as const,
  checkout: "/checkout" as const,
  notifications: "/notifications" as const,

  menuCategory: (cat: string) =>
    ({ pathname: "/menu" as const, params: { cat } }) as const,

  productDetail: (id: string) =>
    ({ pathname: "/product/[id]" as const, params: { id } }) as const,

  orderDetail: (id: string) =>
    ({ pathname: "/order/[id]" as const, params: { id } }) as const,

  settings: (slug: string) =>
    ({ pathname: "/settings/[slug]" as const, params: { slug } }) as const,
} as const;

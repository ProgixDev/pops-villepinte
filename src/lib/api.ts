import { supabase } from "./supabase";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | undefined>;
};

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `${API_BASE}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.append(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(await getAuthHeaders()),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const err = errorBody?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "ERROR",
      err.message ?? `Request failed with status ${res.status}`,
    );
  }

  const json = await res.json();
  return json.data as T;
}

// ─── Typed API methods ───────────────────────────────────────────────

export const menuApi = {
  getCategories: () => api<Category[]>("/menu/categories"),
  getProducts: (params?: { category_id?: string; search?: string }) =>
    api<Product[]>("/menu/products", { params }),
  getProduct: (id: string) => api<Product>(`/menu/products/${id}`),
  getSupplements: () => api<Supplement[]>("/menu/supplements"),
  getSignatures: () => api<Product[]>("/menu/signatures"),
  getAdvice: () => api<Product[]>("/menu/advice"),
  getAccompagnements: () =>
    api<Accompagnement[]>("/accompagnements"),
  getShopSettings: () => api<ShopSettings>("/menu/shop-settings"),
};

export const profileApi = {
  get: () => api<ProfileData>("/profile"),
  update: (data: { name?: string }) =>
    api<ProfileData>("/profile", { method: "PATCH", body: data }),
};

export type NotificationKind = "order" | "broadcast";

export type NotificationData = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  order_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type LoyaltyConfig = {
  habitue_min: number;
  vip_min: number;
  legende_min: number;
};

export const loyaltyApi = {
  get: () => api<LoyaltyConfig>("/loyalty"),
};

export const notificationsApi = {
  list: (limit?: number) =>
    api<NotificationData[]>("/notifications", { params: { limit } }),
  unreadCount: () => api<number>("/notifications/unread-count"),
  markRead: (id: string) =>
    api<NotificationData | null>(`/notifications/${id}/read`, {
      method: "PATCH",
    }),
  markAllRead: () =>
    api<{ ok: boolean }>("/notifications/read-all", { method: "PATCH" }),
  registerToken: (token: string, platform: "ios" | "android" | "web") =>
    api<{ ok: boolean }>("/profile/device-tokens", {
      method: "POST",
      body: { token, platform },
    }),
};

export const favoritesApi = {
  list: () => api<string[]>("/favorites"),
  add: (productId: string) =>
    api<{ ok: boolean }>(`/favorites/${productId}`, { method: "POST" }),
  remove: (productId: string) =>
    api<{ ok: boolean }>(`/favorites/${productId}`, { method: "DELETE" }),
};

export const ordersApi = {
  create: (data: CreateOrderPayload) =>
    api<OrderData>("/orders", { method: "POST", body: data }),
  list: (filter?: "active" | "past") =>
    api<OrderData[]>("/orders", { params: { filter } }),
  get: (id: string) => api<OrderData>(`/orders/${id}`),
  cancel: (id: string) =>
    api<OrderData>(`/orders/${id}/cancel`, { method: "PATCH" }),
  confirmPickedUp: (id: string) =>
    api<OrderData>(`/orders/${id}/picked-up`, { method: "PATCH" }),
};

// ─── API Types ───────────────────────────────────────────────────────

export type Category = {
  id: string;
  name: string;
  icon: string;
  display_order: number;
  is_active: boolean;
};

export type Supplement = {
  id: string;
  name: string;
  price_eur: number;
  is_active: boolean;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  label: string;
  price_eur: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price_eur: number;
  category_id: string;
  image_url: string | null;
  tags: string[];
  prep_time_minutes: number;
  is_available: boolean;
  is_active: boolean;
  product_variants: ProductVariant[];
  product_supplements: { supplement_id: string; supplements: Supplement }[];
};

export type DayHours = { closed: boolean; open: string; close: string };
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type ShopSettings = {
  open_days: string;
  open_hours: string;
  hours_by_day?: Partial<Record<DayKey, DayHours>>;
  delivery_base_fee_eur?: number;
  delivery_per_km_eur?: number;
  updated_at: string;
};

export type Accompagnement = {
  id: string;
  name: string;
  price_eur: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ProfileData = {
  id: string;
  name: string;
  phone: string;
  order_count: number;
  role: string;
  loyalty_tier: string;
};

export type CreateOrderPayload = {
  customerName: string;
  items: {
    productId?: string;
    accompagnementId?: string;
    variantId?: string;
    quantity: number;
    supplements?: string[];
    notes?: string;
  }[];
  notes?: string;
  pickupMode?: "pickup" | "delivery";
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
};

export type OrderItemData = {
  id: string;
  product_id: string | null;
  accompagnement_id: string | null;
  variant_id: string | null;
  quantity: number;
  unit_price_eur: number;
  line_total_eur: number;
  supplements: { id: string; name: string; priceEUR: number }[];
  notes: string | null;
};

export type OrderData = {
  id: string;
  user_id: string;
  customer_name: string;
  total_eur: number;
  status: string;
  estimated_ready_at: string;
  picked_up_at: string | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItemData[];
  pickup_mode?: "pickup" | "delivery";
  delivery_address?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_fee_eur?: number;
};

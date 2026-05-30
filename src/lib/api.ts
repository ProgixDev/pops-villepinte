import {
  getCurrentAccessToken,
  setCurrentAccessToken,
  supabase,
} from "./supabase";

// Strip any trailing slash: joining a `.../api/v1/` base with a `/path` produces
// a `//` URL that Vercel answers with a 308 redirect. iOS can't replay a POST
// body across that redirect, so requests fail with "Network request failed"
// (Android's OkHttp replays the body and masks the bug).
const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

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

// Refresh if the access token is within this window of expiring (or already
// expired). Supabase tokens live ~1h; refreshing a minute early avoids racing
// the clock on a slow request.
const EXPIRY_REFRESH_MARGIN_MS = 60_000;

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Read the persisted session and proactively refresh when the access token
  // is expired / near expiry. The previous implementation returned the
  // in-memory mirror UNCONDITIONALLY, which meant getSession()/refresh was
  // never reached — so an expired token kept getting sent forever, producing
  // the backend "token is expired" 401s. The mirror is now only a fallback for
  // the brief window right after setSession() where getSession() can still
  // resolve null.
  let token: string | null = null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const expiresAtMs = (session.expires_at ?? 0) * 1000;
      const nearExpiry =
        expiresAtMs > 0 && expiresAtMs - Date.now() < EXPIRY_REFRESH_MARGIN_MS;
      if (nearExpiry) {
        const { data } = await supabase.auth.refreshSession();
        token = data.session?.access_token ?? session.access_token ?? null;
      } else {
        token = session.access_token ?? null;
      }
    }
  } catch {
    token = null;
  }

  if (!token) token = getCurrentAccessToken();
  if (!token) return {};

  setCurrentAccessToken(token);
  return { Authorization: `Bearer ${token}` };
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

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(await getAuthHeaders()),
    };
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // Safety net: a 401 usually means the access token expired between the
  // header build and the server check (or the refresh token rotated). Force a
  // single refresh and retry once before surfacing the error.
  if (res.status === 401) {
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data.session?.access_token) {
        setCurrentAccessToken(data.session.access_token);
      }
    } catch {
      // Refresh failed (revoked / offline) — fall through to the error below.
    }
    res = await doFetch();
  }

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

// ─── Driver API ──────────────────────────────────────────────────────
// All routes are gated server-side by DriverGuard (profiles.role==='driver').
// A non-driver bearer token returns 403, which is exactly what we want for
// defense in depth on top of the client-side role gate.

export type DriverAssignmentStatus =
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled";

export type DriverAssignmentOrder = {
  id: string;
  total_eur: number;
  delivery_fee_eur: number;
  status: string;
  pickup_mode: "pickup" | "delivery" | null;
  customer_name: string;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  created_at: string;
  estimated_ready_at: string | null;
};

export type DriverAssignment = {
  id: string;
  order_id: string;
  driver_id: string;
  status: DriverAssignmentStatus;
  note: string | null;
  assigned_by: string | null;
  assigned_at: string;
  responded_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  orders: DriverAssignmentOrder | null;
};

export type DriverProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  role: "driver";
  is_blocked: boolean;
  is_active: boolean;
  vehicle: "scooter" | "bike" | "car" | null;
  license_plate: string | null;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverEarnings = {
  period: "today" | "week" | "month";
  since: string;
  deliveries: number;
  delivery_fees_eur: number;
  gross_eur: number;
};

export const driverApi = {
  me: () => api<DriverProfile>("/driver/me"),
  setOnline: (is_active: boolean) =>
    api<{ id: string; is_active: boolean }>("/driver/me/online", {
      method: "PATCH",
      body: { is_active },
    }),
  registerPushToken: (expo_push_token: string) =>
    api<{ id: string; expo_push_token: string }>("/driver/push-token", {
      method: "POST",
      body: { expo_push_token },
    }),
  listAssignments: (status?: DriverAssignmentStatus) =>
    api<DriverAssignment[]>("/driver/assignments", {
      params: status ? { status } : undefined,
    }),
  getAssignment: (id: string) =>
    api<DriverAssignment>(`/driver/assignments/${id}`),
  respond: (
    id: string,
    status: "accepted" | "refused",
    note?: string,
  ) =>
    api<DriverAssignment>(`/driver/assignments/${id}/respond`, {
      method: "PATCH",
      body: { status, note: note?.trim() || undefined },
    }),
  pickedUp: (id: string) =>
    api<DriverAssignment>(`/driver/assignments/${id}/picked-up`, {
      method: "PATCH",
    }),
  delivered: (id: string) =>
    api<DriverAssignment>(`/driver/assignments/${id}/delivered`, {
      method: "PATCH",
    }),
  earnings: (period?: "today" | "week" | "month") =>
    api<DriverEarnings>("/driver/earnings", {
      params: period ? { period } : undefined,
    }),
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
  /** Superadmin support line surfaced to drivers ("Appeler le support"). */
  support_phone?: string | null;
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
  /** Only populated on /orders/:id (not the list); null when not assigned. */
  active_driver_id?: string | null;
};

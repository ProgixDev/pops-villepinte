export type Category = {
  id: string;
  name: string;
  icon: string;
  display_order: number;
};

export type Supplement = {
  id: string;
  name: string;
  price_eur: number;
};

export type ProductVariant = {
  id: string;
  label: string;
  price_eur: number;
};

export type ProductTag = "NOUVEAU" | "PROMO" | "TOP" | "SPICY";

export type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_eur: number;
  product_variants: ProductVariant[];
  product_supplements: { supplement_id: string; supplements: Supplement }[];
  image_url: string | null;
  tags: ProductTag[];
  prep_time_minutes: number;
  is_available: boolean;
  is_active: boolean;
};

export type CartItem = {
  id: string;
  productId?: string;
  accompagnementId?: string;
  variantId?: string;
  quantity: number;
  supplements: string[];
  notes?: string;
};

export type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "handed_to_livreur"
  | "picked_up"
  | "cancelled";

export type Order = {
  id: string;
  items: CartItem[];
  totalEUR: number;
  status: OrderStatus;
  createdAt: string;
  estimatedReadyAt: string;
  pickedUpAt?: string;
  customerName: string;
  pickupMode?: "pickup" | "delivery";
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryFeeEUR?: number;
  /**
   * Driver id of the currently in-flight accepted assignment, if any.
   * Server-populated only for the single-order endpoint (not the list).
   * Drives the customer-side live tracking map.
   */
  activeDriverId?: string | null;
};

export type Profile = {
  name: string;
  phone: string;
  orderCount: number;
};

export type Accompagnement = {
  id: string;
  name: string;
  price_eur: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

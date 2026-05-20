export type ProductTag = 'NOUVEAU' | 'PROMO' | 'TOP' | 'SPICY';
export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'handed_to_livreur'
  | 'picked_up'
  | 'cancelled';

export type PickupMode = 'pickup' | 'delivery';
export type AppRole = 'customer' | 'admin';

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export interface Supplement {
  id: string;
  name: string;
  priceEUR: number;
}

export interface ProductVariant {
  id: string;
  label: string;
  priceEUR: number;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceEUR: number;
  variants?: ProductVariant[];
  imageUrl: string | null;
  tags: ProductTag[];
  availableSupplements: string[];
  prepTimeMinutes: number;
}

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  role: AppRole;
}

export interface OrderItemSnapshotSupplement {
  id: string;
  name: string;
  priceEUR: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPriceEUR: number;
  supplements: OrderItemSnapshotSupplement[];
  notes: string | null;
  lineTotalEUR: number;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string | null;
  items: OrderItem[];
  totalEUR: number;
  status: OrderStatus;
  createdAt: string;
  estimatedReadyAt: string;
  pickedUpAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
}

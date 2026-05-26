import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  isActiveOrderStatus,
  isTerminalOrderStatus,
} from "@/constants/orderStatus";
import {
  ordersApi,
  type CreateOrderPayload,
  type OrderData,
} from "@/lib/api";
import type { CartItem, Order } from "@/types";

import { asyncStorageAdapter } from "./_storage";

/** Map API order data to the UI Order type */
function toOrder(data: OrderData): Order {
  return {
    id: data.id,
    items: data.order_items.map((item) => ({
      id: item.id,
      productId: item.product_id ?? undefined,
      accompagnementId: item.accompagnement_id ?? undefined,
      variantId: item.variant_id ?? undefined,
      quantity: item.quantity,
      supplements: item.supplements.map((s) => s.id),
      notes: item.notes ?? undefined,
    })),
    totalEUR: data.total_eur,
    status: data.status as Order["status"],
    createdAt: data.created_at,
    estimatedReadyAt: data.estimated_ready_at,
    pickedUpAt: data.picked_up_at ?? undefined,
    customerName: data.customer_name,
    pickupMode: data.pickup_mode,
    deliveryAddress: data.delivery_address ?? undefined,
    deliveryLat: data.delivery_lat ?? undefined,
    deliveryLng: data.delivery_lng ?? undefined,
    deliveryFeeEUR: data.delivery_fee_eur,
    activeDriverId: data.active_driver_id ?? null,
  };
}

export type PlaceOrderDelivery =
  | { pickupMode: "pickup" }
  | {
      pickupMode: "delivery";
      address: string;
      lat: number;
      lng: number;
    };

type OrdersState = {
  active: Order | null;
  history: Order[];
  loading: boolean;
  error: string | null;
  placeOrder: (
    cartItems: CartItem[],
    customerName: string,
    delivery?: PlaceOrderDelivery,
  ) => Promise<Order>;
  fetchOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<Order | null>;
  cancelOrder: (id: string) => Promise<void>;
  confirmPickedUp: (id: string) => Promise<Order>;
  refreshActive: () => Promise<void>;
  clearError: () => void;
};

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      active: null,
      history: [],
      loading: false,
      error: null,

      placeOrder: async (
        cartItems: CartItem[],
        customerName: string,
        delivery?: PlaceOrderDelivery,
      ) => {
        set({ loading: true, error: null });

        const payload: CreateOrderPayload = {
          customerName,
          items: cartItems.map((item) => ({
            productId: item.productId,
            accompagnementId: item.accompagnementId,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
            supplements: item.supplements.length > 0 ? item.supplements : undefined,
            notes: item.notes ?? undefined,
          })),
        };

        if (delivery && delivery.pickupMode === "delivery") {
          payload.pickupMode = "delivery";
          payload.deliveryAddress = delivery.address;
          payload.deliveryLat = delivery.lat;
          payload.deliveryLng = delivery.lng;
        } else {
          payload.pickupMode = "pickup";
        }

        try {
          const data = await ordersApi.create(payload);
          const order = toOrder(data);
          set({ active: order, loading: false });
          return order;
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : "Erreur lors de la commande";
          set({ error: message, loading: false });
          throw e;
        }
      },

      fetchOrders: async () => {
        set({ loading: true });
        try {
          const [activeData, pastData] = await Promise.all([
            ordersApi.list("active"),
            ordersApi.list("past"),
          ]);

          const currentActive = activeData.length > 0 ? toOrder(activeData[0]) : null;
          const history = pastData.map(toOrder);
          set({ active: currentActive, history, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      fetchOrderById: async (id: string) => {
        try {
          const data = await ordersApi.get(id);
          const order = toOrder(data);
          if (isActiveOrderStatus(order.status)) {
            set({ active: order });
          }
          return order;
        } catch {
          return null;
        }
      },

      confirmPickedUp: async (id: string) => {
        try {
          const data = await ordersApi.confirmPickedUp(id);
          const order = toOrder(data);
          // Picked-up is terminal — drop from active, prepend to history.
          set((state) => ({
            active: state.active?.id === id ? null : state.active,
            history: [order, ...state.history.filter((o) => o.id !== id)],
          }));
          return order;
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : "Confirmation impossible";
          set({ error: message });
          throw e;
        }
      },

      cancelOrder: async (id: string) => {
        try {
          const data = await ordersApi.cancel(id);
          const order = toOrder(data);
          set((state) => ({
            active: state.active?.id === id ? null : state.active,
            history: [order, ...state.history],
          }));
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Annulation impossible";
          set({ error: message });
          throw e;
        }
      },

      refreshActive: async () => {
        const { active } = get();
        if (!active) return;
        try {
          const data = await ordersApi.get(active.id);
          const order = toOrder(data);
          if (isTerminalOrderStatus(order.status)) {
            set((state) => ({
              active: null,
              history: [order, ...state.history],
            }));
          } else {
            set({ active: order });
          }
        } catch {
          // ignore
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "pops.orders.v2",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({
        active: state.active,
        history: state.history,
      }),
    },
  ),
);

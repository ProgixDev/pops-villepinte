import { create } from "zustand";

import { driverApi } from "@/lib/api";
import { mapAssignmentToDelivery } from "@/lib/driver/mapAssignment";
import type { Delivery, DeliveryStatus } from "@/types/driver";

type DeliveriesState = {
  byId: Record<string, Delivery>;
  order: string[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  respond: (
    id: string,
    status: "accepted" | "refused",
    note?: string,
  ) => Promise<void>;
  markPickedUp: (id: string) => Promise<void>;
  markDelivered: (id: string) => Promise<void>;
};

function activeIdFromList(items: Delivery[]): string | null {
  // "Active" is the one currently in flight from the driver's POV — accepted
  // (en route to pickup) or picked_up (en route to drop-off). Picks the most
  // recently assigned one if there's somehow more than one.
  const inflight = items.filter(
    (d) => d.status === "accepted" || d.status === "picked_up",
  );
  return inflight[0]?.id ?? null;
}

export const useDeliveriesStore = create<DeliveriesState>()((set, get) => ({
  byId: {},
  order: [],
  activeId: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await driverApi.listAssignments();
      const deliveries = rows.map(mapAssignmentToDelivery);
      const byId: Record<string, Delivery> = {};
      const order: string[] = [];
      for (const d of deliveries) {
        byId[d.id] = d;
        order.push(d.id);
      }
      set({
        byId,
        order,
        activeId: activeIdFromList(deliveries),
        loading: false,
      });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Erreur réseau",
      });
    }
  },

  respond: async (id, status, note) => {
    const updated = await driverApi.respond(id, status, note);
    const mapped = mapAssignmentToDelivery(updated);
    set((s) => {
      const nextById = { ...s.byId, [id]: mapped };
      const nextActive = activeIdFromList(Object.values(nextById));
      return { byId: nextById, activeId: nextActive };
    });
  },

  markPickedUp: async (id) => {
    const updated = await driverApi.pickedUp(id);
    const mapped = mapAssignmentToDelivery(updated);
    set((s) => ({ byId: { ...s.byId, [id]: mapped }, activeId: id }));
  },

  markDelivered: async (id) => {
    const updated = await driverApi.delivered(id);
    const mapped = mapAssignmentToDelivery(updated);
    set((s) => {
      const next = { ...s.byId, [id]: mapped };
      return {
        byId: next,
        activeId: s.activeId === id ? null : s.activeId,
      };
    });
  },
}));

export function selectActiveDelivery(s: DeliveriesState): Delivery | null {
  if (s.activeId === null) return null;
  return s.byId[s.activeId] ?? null;
}

export function selectAssignedDeliveries(s: DeliveriesState): Delivery[] {
  return s.order
    .map((id) => s.byId[id])
    .filter((d): d is Delivery => d !== undefined && d.status === "assigned");
}

export function selectCompletedDeliveries(s: DeliveriesState): Delivery[] {
  return s.order
    .map((id) => s.byId[id])
    .filter(
      (d): d is Delivery =>
        d !== undefined &&
        (d.status === "delivered" || d.status === "cancelled"),
    );
}

// kept for legacy import compatibility in the ported screens
export type { DeliveryStatus };

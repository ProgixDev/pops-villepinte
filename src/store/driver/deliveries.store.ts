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
  markDelivered: (
    id: string,
    payload: { method: "qr" | "manual"; code?: string },
  ) => Promise<void>;
  cancelDelivery: (id: string, reason?: string) => Promise<void>;
  reportProblem: (
    id: string,
    payload: { category: string; description?: string },
  ) => Promise<void>;
  reset: () => void;
};

function activeIdFromList(items: Delivery[]): string | null {
  // "Active" is the one currently in flight from the driver's POV — accepted
  // means they've taken the food and are en route to the customer. Picks the
  // most recently assigned one if there's somehow more than one.
  const inflight = items.filter((d) => d.status === "accepted");
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
      // Re-derive active from the fetch ordering (s.order), NOT Object.values:
      // map insertion order isn't assigned_at order, so picking inflight[0]
      // from unordered values could point the "En cours" card at the wrong
      // course after interleaved responds/refetches.
      const ordered = s.order
        .map((oid) => nextById[oid])
        .filter((d): d is Delivery => d !== undefined);
      return { byId: nextById, activeId: activeIdFromList(ordered) };
    });
  },

  markDelivered: async (id, payload) => {
    const updated = await driverApi.delivered(id, payload);
    const mapped = mapAssignmentToDelivery(updated);
    set((s) => {
      const next = { ...s.byId, [id]: mapped };
      return {
        byId: next,
        activeId: s.activeId === id ? null : s.activeId,
      };
    });
  },

  cancelDelivery: async (id, reason) => {
    const updated = await driverApi.cancelDelivery(id, reason);
    const mapped = mapAssignmentToDelivery(updated);
    set((s) => {
      const next = { ...s.byId, [id]: mapped };
      return {
        byId: next,
        activeId: s.activeId === id ? null : s.activeId,
      };
    });
  },

  reportProblem: async (id, payload) => {
    await driverApi.reportProblem(id, payload);
    // The course stays undelivered; refresh so any server-side change (e.g. an
    // admin reassigning it) shows up.
    await get().fetch();
  },

  // Wipe all delivery state. Called on logout so the next driver to sign in on
  // this device never sees the previous driver's courses / active card.
  reset: () => set({ byId: {}, order: [], activeId: null, loading: false, error: null }),
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

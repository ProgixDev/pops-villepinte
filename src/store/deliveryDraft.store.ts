import { create } from "zustand";

import type { DeliveryAddress } from "@/lib/delivery";

/**
 * Throwaway slot used to shuttle a picked delivery address from the
 * full-screen Mapbox picker back to the checkout screen. Persistence is
 * intentionally absent — the cart owns it once it leaves checkout.
 */
type DeliveryDraftState = {
  picked: DeliveryAddress | null;
  setPicked: (a: DeliveryAddress | null) => void;
  clear: () => void;
};

export const useDeliveryDraftStore = create<DeliveryDraftState>((set) => ({
  picked: null,
  setPicked: (a) => set({ picked: a }),
  clear: () => set({ picked: null }),
}));

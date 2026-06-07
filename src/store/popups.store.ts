import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { menuApi, type Popup } from "@/lib/api";

import { asyncStorageAdapter } from "./_storage";

// Local YYYY-MM-DD key. Drives the "show each poster at most once per day"
// rule — a poster is eligible again once the calendar day rolls over.
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type PopupsState = {
  popups: Popup[];
  // popup id → day key it was last dismissed/shown. Persisted across launches.
  seen: Record<string, string>;
  loading: boolean;
  fetch: (tier?: string) => Promise<void>;
  markSeen: (id: string) => void;
  /** Posters not yet seen today, in display order. */
  eligible: () => Popup[];
};

export const usePopupsStore = create<PopupsState>()(
  persist(
    (set, get) => ({
      popups: [],
      seen: {},
      loading: false,

      fetch: async (tier) => {
        set({ loading: true });
        try {
          const popups = await menuApi.getPopups(tier);
          set({ popups, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      markSeen: (id) => {
        set((state) => ({ seen: { ...state.seen, [id]: todayKey() } }));
      },

      eligible: () => {
        const { popups, seen } = get();
        const today = todayKey();
        return [...popups]
          .filter((p) => seen[p.id] !== today)
          .sort((a, b) => a.sort_order - b.sort_order);
      },
    }),
    {
      name: "pops.popups.v1",
      storage: createJSONStorage(() => asyncStorageAdapter),
      // Only the seen map needs to survive restarts; posters are re-fetched.
      partialize: (state) => ({ seen: state.seen }),
    },
  ),
);

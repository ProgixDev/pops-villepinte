import { create } from "zustand";

import { driverApi } from "@/lib/api";

type EarningsBucket = {
  amountEUR: number;
  deliveries: number;
};

type EarningsState = {
  today: EarningsBucket;
  week: EarningsBucket;
  month: EarningsBucket;
  // Approximate hours-online tracker; client-side only for now since the
  // server doesn't keep an online-session log yet. Resets at midnight via
  // the screen-side check.
  hoursOnlineToday: number;
  loading: boolean;
  fetchAll: () => Promise<void>;
  addOnlineMinutes: (min: number) => void;
  reset: () => void;
};

const empty: EarningsBucket = { amountEUR: 0, deliveries: 0 };

export const useEarningsStore = create<EarningsState>()((set) => ({
  today: empty,
  week: empty,
  month: empty,
  hoursOnlineToday: 0,
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [today, week, month] = await Promise.all([
        driverApi.earnings("today"),
        driverApi.earnings("week"),
        driverApi.earnings("month"),
      ]);
      set({
        today: {
          amountEUR: today.delivery_fees_eur,
          deliveries: today.deliveries,
        },
        week: {
          amountEUR: week.delivery_fees_eur,
          deliveries: week.deliveries,
        },
        month: {
          amountEUR: month.delivery_fees_eur,
          deliveries: month.deliveries,
        },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  addOnlineMinutes: (min) => {
    set((s) => ({ hoursOnlineToday: s.hoursOnlineToday + min / 60 }));
  },

  // Clear on logout so the next driver doesn't see the previous driver's
  // earnings totals before their own fetch resolves.
  reset: () =>
    set({ today: empty, week: empty, month: empty, hoursOnlineToday: 0, loading: false }),
}));

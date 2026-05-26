import { create } from "zustand";

import { driverApi } from "@/lib/api";
import type { DriverProfileView } from "@/types/driver";

type DriverProfileState = {
  profile: DriverProfileView;
  online: boolean;
  loading: boolean;
  fetch: () => Promise<void>;
  toggleOnline: () => Promise<void>;
  setOnline: (online: boolean) => Promise<void>;
};

const defaultProfile: DriverProfileView = {
  name: "",
  phone: "",
  vehicle: "scooter",
  rating: 0,
  deliveryCount: 0,
};

export const useDriverProfileStore = create<DriverProfileState>()((set, get) => ({
  profile: defaultProfile,
  online: false,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const me = await driverApi.me();
      set({
        profile: {
          name: me.name ?? "",
          phone: me.phone ?? "",
          vehicle: me.vehicle ?? "scooter",
          licensePlate: me.license_plate ?? undefined,
          rating: 0,
          deliveryCount: 0,
        },
        online: me.is_active,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  toggleOnline: async () => {
    const next = !get().online;
    set({ online: next }); // optimistic
    try {
      await driverApi.setOnline(next);
    } catch {
      set({ online: !next }); // rollback
    }
  },

  setOnline: async (online) => {
    set({ online }); // optimistic
    try {
      await driverApi.setOnline(online);
    } catch {
      set({ online: !online }); // rollback
    }
  },
}));

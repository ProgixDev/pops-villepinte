import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { GUEST_NAME, isGuestName } from "@/constants/profile";
import { profileApi, type ProfileData } from "@/lib/api";

import { useAuthStore } from "./auth.store";
import { asyncStorageAdapter } from "./_storage";

type ProfileState = {
  profile: {
    name: string;
    phone: string;
    orderCount: number;
    loyaltyTier: string;
  };
  loading: boolean;
  setName: (name: string) => void;
  setPhone: (phone: string) => void;
  incrementOrderCount: () => void;
  fetchProfile: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: {
        name: GUEST_NAME,
        phone: "",
        orderCount: 0,
        loyaltyTier: "BIENVENUE",
      },
      loading: false,

      setName: (name) => {
        set((state) => ({ profile: { ...state.profile, name } }));
      },

      setPhone: (phone) => {
        set((state) => ({ profile: { ...state.profile, phone } }));
      },

      incrementOrderCount: () => {
        set((state) => ({
          profile: {
            ...state.profile,
            orderCount: state.profile.orderCount + 1,
          },
        }));
      },

      fetchProfile: async () => {
        set({ loading: true });
        try {
          const data: ProfileData = await profileApi.get();
          set({
            profile: {
              name: data.name || GUEST_NAME,
              phone: data.phone || "",
              orderCount: data.order_count,
              loyaltyTier: data.loyalty_tier,
            },
            loading: false,
          });
          // profiles.name is the truth source for "did the user finish signup?".
          // Auth store may have signupDone=false (fresh install on a returning
          // user, missing user_metadata.name, etc.) — fix it here.
          if (!isGuestName(data.name)) {
            useAuthStore.setState({ signupDone: true });
          }
        } catch {
          set({ loading: false });
        }
      },

      updateName: async (name: string) => {
        try {
          const data: ProfileData = await profileApi.update({ name });
          set({
            profile: {
              name: data.name || name,
              phone: data.phone || get().profile.phone,
              orderCount: data.order_count,
              loyaltyTier: data.loyalty_tier,
            },
          });
        } catch {
          // Optimistic update even if API fails
          set((state) => ({ profile: { ...state.profile, name } }));
        }
      },
    }),
    {
      name: "pops.profile.v2",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);

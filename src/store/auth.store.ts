import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { normalizeFrenchMobile } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

import { asyncStorageAdapter } from "./_storage";

const DEV_AUTH = process.env.EXPO_PUBLIC_DEV_AUTH === "true";
const DEV_OTP_CODE = "000000";
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export type AuthChoice = "signin" | "register" | null;

type AuthState = {
  onboardingDone: boolean;
  authed: boolean;
  signupDone: boolean;
  authChoice: AuthChoice;
  phone: string;
  loading: boolean;
  completeOnboarding: () => void;
  setAuthChoice: (choice: AuthChoice) => void;
  sendOtp: (phone: string) => Promise<{ error?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ error?: string; isNewUser?: boolean }>;
  completeSignup: () => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  user?: { id?: string };
};

type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

async function postApi<T>(
  path: string,
  body: unknown,
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (!res.ok) {
      return { error: json.error?.message ?? `Request failed (${res.status})` };
    }
    return { data: json.data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      onboardingDone: false,
      authed: false,
      signupDone: false,
      authChoice: null,
      phone: "",
      loading: false,

      completeOnboarding: () => {
        set({ onboardingDone: true });
      },

      setAuthChoice: (choice) => {
        set({ authChoice: choice });
      },

      sendOtp: async (rawPhone: string) => {
        set({ loading: true });
        const phone = normalizeFrenchMobile(rawPhone);
        if (!phone) {
          set({ loading: false });
          return { error: "Numéro invalide." };
        }

        // Dev bypass: skip Prelude entirely, accept the constant code on verify.
        if (DEV_AUTH) {
          set({ loading: false, phone });
          return {};
        }

        const { error } = await postApi("/auth/send-code", { phone });
        set({ loading: false });
        return error ? { error } : {};
      },

      verifyOtp: async (rawPhone: string, code: string) => {
        set({ loading: true });
        const phone = normalizeFrenchMobile(rawPhone);
        if (!phone) {
          set({ loading: false });
          return { error: "Numéro invalide." };
        }

        const endpoint = DEV_AUTH ? "/auth/dev-signin" : "/auth/verify-code";
        if (DEV_AUTH && code !== DEV_OTP_CODE) {
          set({ loading: false });
          return { error: `Code invalide (utilise ${DEV_OTP_CODE} en dev)` };
        }

        const { data, error } = await postApi<SessionPayload>(endpoint, {
          phone,
          code,
        });
        if (error || !data) {
          set({ loading: false });
          return { error: error ?? "Sign-in failed" };
        }

        const { error: sessionErr, data: sessionData } =
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
        if (sessionErr) {
          set({ loading: false });
          return { error: sessionErr.message };
        }

        const isNewUser = !sessionData.user?.user_metadata?.name;
        set({
          authed: true,
          phone,
          signupDone: !isNewUser,
          authChoice: null,
          loading: false,
        });
        return { isNewUser };
      },

      completeSignup: () => {
        set({ signupDone: true });
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ authed: false, signupDone: false, phone: "", authChoice: null });
      },

      restoreSession: async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        // Don't downgrade signupDone here: profiles.name (not user_metadata)
        // is the source of truth, and fetchProfile() resolves it. Promote
        // to true if metadata happens to have it; otherwise trust the
        // persisted value.
        set((state) => ({
          authed: true,
          phone: session.user.phone ?? "",
          signupDone:
            state.signupDone || !!session.user.user_metadata?.name,
        }));
      },
    }),
    {
      name: "pops.auth.v2",
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({
        onboardingDone: state.onboardingDone,
        authed: state.authed,
        signupDone: state.signupDone,
        authChoice: state.authChoice,
        phone: state.phone,
      }),
    },
  ),
);

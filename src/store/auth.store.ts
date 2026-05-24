import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { setCurrentAccessToken, supabase } from "@/lib/supabase";

import { useFavoritesStore } from "./favorites.store";
import { asyncStorageAdapter } from "./_storage";

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
  /**
   * Mirror of the current supabase access token. Kept in memory only (NOT
   * persisted) so that on cold start we always restore from supabase's own
   * storage and never ship an expired token to the API. The `api()` client
   * reads this first, which avoids a class of production bugs where
   * `supabase.auth.getSession()` returns null even though `setSession()` just
   * succeeded — those manifested as "Missing bearer token" on the first
   * fetches after signup.
   */
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  completeOnboarding: () => void;
  setAuthChoice: (choice: AuthChoice) => void;
  /** `phone` MUST be E.164 (e.g. `+33612345678`). */
  sendOtp: (phone: string) => Promise<{ error?: string }>;
  /** `phone` MUST be E.164. */
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
      accessToken: null,

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      completeOnboarding: () => {
        set({ onboardingDone: true });
      },

      setAuthChoice: (choice) => {
        set({ authChoice: choice });
      },

      sendOtp: async (phone: string) => {
        set({ loading: true });
        if (!phone.startsWith("+")) {
          set({ loading: false });
          return { error: "Numéro invalide." };
        }

        const { error } = await postApi("/auth/send-code", { phone });
        set({ loading: false });
        return error ? { error } : {};
      },

      verifyOtp: async (phone: string, code: string) => {
        set({ loading: true });
        if (!phone.startsWith("+")) {
          set({ loading: false });
          return { error: "Numéro invalide." };
        }

        const { data, error } = await postApi<SessionPayload>(
          "/auth/verify-code",
          { phone, code },
        );
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

        // Mirror the token immediately. supabase.auth.getSession() can return
        // null in a brief window after setSession() in production builds, so
        // the api client uses this mirror as the source of truth for the
        // bearer header. Push it into the supabase.ts module mirror BEFORE
        // we flip `authed`, otherwise the React effect listening on `authed`
        // can fire post-login API calls before the SIGNED_IN event reaches
        // the mirror — that race is what produced the 401s on /profile,
        // /favorites, /notifications and /profile/device-tokens immediately
        // after sign-in on TestFlight.
        const resolvedToken =
          sessionData.session?.access_token ?? data.access_token;
        setCurrentAccessToken(resolvedToken);
        const isNewUser = !sessionData.user?.user_metadata?.name;
        set({
          authed: true,
          accessToken: resolvedToken,
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
        setCurrentAccessToken(null);
        useFavoritesStore.getState().clear();
        set({
          authed: false,
          signupDone: false,
          phone: "",
          authChoice: null,
          accessToken: null,
        });
      },

      restoreSession: async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          // Persisted `authed=true` is stale (supabase storage was cleared,
          // token expired, etc). Downgrade so the UI doesn't keep firing
          // token-less API calls — those produce the "Missing bearer token"
          // server logs the user was seeing in production.
          setCurrentAccessToken(null);
          set({ authed: false, accessToken: null });
          return;
        }
        // Push the token into the supabase.ts mirror BEFORE flipping
        // `authed`, otherwise the React effect that fans out post-auth API
        // calls can race ahead of the SIGNED_IN broadcast.
        setCurrentAccessToken(session.access_token);
        // Don't downgrade signupDone here: profiles.name (not user_metadata)
        // is the source of truth, and fetchProfile() resolves it. Promote
        // to true if metadata happens to have it; otherwise trust the
        // persisted value.
        set((state) => ({
          authed: true,
          accessToken: session.access_token,
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

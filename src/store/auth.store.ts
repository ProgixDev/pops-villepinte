import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { setCurrentAccessToken, supabase } from "@/lib/supabase";

import { useFavoritesStore } from "./favorites.store";
import { useDeliveriesStore } from "./driver/deliveries.store";
import { useDriverProfileStore } from "./driver/profile.store";
import { useEarningsStore } from "./driver/earnings.store";
import { asyncStorageAdapter } from "./_storage";

// Strip any trailing slash so a `.../api/v1/` base + `/path` doesn't become a
// `//` URL — that triggers a Vercel 308 redirect whose POST body iOS can't
// replay, surfacing as "Network request failed" (Android masks it via OkHttp).
const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

export type AuthChoice = "signin" | "register" | "driver-signin" | null;

export type UserRole = "customer" | "driver" | null;

type AuthState = {
  onboardingDone: boolean;
  authed: boolean;
  signupDone: boolean;
  authChoice: AuthChoice;
  phone: string;
  /**
   * Role of the currently authenticated user. Populated from `profiles.role`
   * after sign-in / restoreSession. Drives which tab group renders in the
   * root layout. Null when not signed in.
   */
  role: UserRole;
  /**
   * `true` once restoreSession has completed (success or failure). The root
   * layout uses this to keep the splash on screen until we've made the final
   * routing decision, so a returning driver never flashes the customer home
   * (and vice versa) before role resolution lands. Not persisted — starts
   * `false` on every cold start.
   */
  sessionRestored: boolean;
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
  /**
   * Driver sign-in via phone + password (drivers are admin-created in the
   * superadmin and given a password; they do NOT use the customer OTP flow).
   * Verifies the user's profiles.role === 'driver' via /driver/me and signs
   * them out if not, so a leaked customer credential can't reach driver UI.
   * `phone` MUST be E.164.
   */
  driverSignIn: (phone: string, password: string) => Promise<{ error?: string }>;
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

type ServerRole = "customer" | "driver" | "admin" | "unknown" | "network-error";

/**
 * Source of truth for "what role does this token's account have on the server".
 * Returns:
 *  - "customer" | "driver" | "admin": value of profiles.role
 *  - "unknown": fetch succeeded but role didn't match any expected enum value
 *  - "network-error": fetch threw (offline) or returned 5xx
 * The caller decides what to do with each.
 */
async function fetchServerRole(token: string): Promise<ServerRole> {
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "network-error";
    const body = (await res.json().catch(() => ({}))) as {
      data?: { role?: string };
    };
    const r = body.data?.role;
    if (r === "customer" || r === "driver" || r === "admin") return r;
    return "unknown";
  } catch {
    return "network-error";
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      onboardingDone: false,
      authed: false,
      signupDone: false,
      authChoice: null,
      phone: "",
      role: null,
      sessionRestored: false,
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

        // Strict role enforcement: customer flow accepts ONLY profiles.role
        // === 'customer'. A driver coming through this flow needs to use the
        // driver sign-in entry; an admin must use the web dashboard. We sign
        // them out so they can pick the right entry point.
        const serverRole = await fetchServerRole(resolvedToken);
        if (__DEV__) console.log("[auth] verifyOtp serverRole =", serverRole);
        if (serverRole !== "customer") {
          await supabase.auth.signOut();
          setCurrentAccessToken(null);
          set({ loading: false });
          return {
            error:
              serverRole === "driver"
                ? "Ce numéro est enregistré comme livreur. Utilise le bouton « Je suis livreur »."
                : serverRole === "admin"
                  ? "Les comptes administrateurs se connectent depuis le tableau de bord web."
                  : "Compte introuvable.",
          };
        }

        const isNewUser = !sessionData.user?.user_metadata?.name;
        set({
          authed: true,
          accessToken: resolvedToken,
          phone,
          role: "customer",
          signupDone: !isNewUser,
          authChoice: null,
          loading: false,
        });
        return { isNewUser };
      },

      driverSignIn: async (phone: string, password: string) => {
        set({ loading: true });
        if (!phone.startsWith("+")) {
          set({ loading: false });
          return { error: "Numéro invalide." };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          phone,
          password,
        });
        if (error || !data.session) {
          set({ loading: false });
          return { error: error?.message ?? "Échec de la connexion" };
        }

        // Mirror the token immediately so the role-check fetch below has a
        // bearer header (same race-fix rationale as verifyOtp above).
        setCurrentAccessToken(data.session.access_token);

        // Strict role enforcement: driver flow accepts ONLY profiles.role
        // === 'driver'. A customer who happens to have a password (the
        // standalone driver app allowed this without checking role) gets
        // rejected; an admin must use the web dashboard.
        const serverRole = await fetchServerRole(data.session.access_token);
        if (__DEV__) console.log("[auth] driverSignIn serverRole =", serverRole);
        if (serverRole !== "driver") {
          await supabase.auth.signOut();
          setCurrentAccessToken(null);
          set({ loading: false });
          return {
            error:
              serverRole === "customer"
                ? "Ce numéro est un compte client, pas un compte livreur."
                : serverRole === "admin"
                  ? "Les comptes administrateurs se connectent depuis le tableau de bord web."
                  : serverRole === "network-error"
                    ? "Impossible de vérifier le compte (réseau). Réessaie."
                    : "Ce numéro n'est pas enregistré comme livreur.",
          };
        }

        set({
          authed: true,
          accessToken: data.session.access_token,
          phone,
          role: "driver",
          // Drivers are admin-created so the "signup" step doesn't apply.
          signupDone: true,
          authChoice: null,
          loading: false,
        });
        return {};
      },

      completeSignup: () => {
        set({ signupDone: true });
      },

      logout: async () => {
        await supabase.auth.signOut();
        setCurrentAccessToken(null);
        useFavoritesStore.getState().clear();
        // Wipe driver state too, so a second driver signing in on the same
        // device never sees the previous driver's courses, profile or earnings.
        useDeliveriesStore.getState().reset();
        useDriverProfileStore.getState().reset();
        useEarningsStore.getState().reset();
        set({
          authed: false,
          signupDone: false,
          phone: "",
          role: null,
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
          set({
            authed: false,
            accessToken: null,
            role: null,
            sessionRestored: true,
          });
          return;
        }
        // Push the token into the supabase.ts mirror BEFORE flipping
        // `authed`, otherwise the React effect that fans out post-auth API
        // calls can race ahead of the SIGNED_IN broadcast.
        setCurrentAccessToken(session.access_token);

        // Server-authoritative role check. We deliberately do NOT trust the
        // persisted role on cold start — admin could have demoted a driver
        // since last app open, or this could be the first launch after the
        // multi-role merge shipped with stale state. /profile returns the
        // canonical profiles.role for whichever account this JWT belongs to.
        const serverRole = await fetchServerRole(session.access_token);
        if (__DEV__) {
          console.log("[auth] restoreSession serverRole =", serverRole);
        }

        // Admins must use the web dashboard. If somehow an admin token
        // survived on a mobile install, force them out.
        if (serverRole === "admin") {
          await supabase.auth.signOut();
          setCurrentAccessToken(null);
          set({
            authed: false,
            accessToken: null,
            role: null,
            phone: "",
            signupDone: false,
            sessionRestored: true,
          });
          return;
        }

        // "unknown" means /profile returned but role didn't match any known
        // enum value (corrupt data, future role, etc.). Treat the same as
        // admin — sign out to be safe.
        if (serverRole === "unknown") {
          await supabase.auth.signOut();
          setCurrentAccessToken(null);
          set({
            authed: false,
            accessToken: null,
            role: null,
            phone: "",
            signupDone: false,
            sessionRestored: true,
          });
          return;
        }

        // Network error → fall back to persisted role so a returning driver
        // doesn't get kicked to the customer home just because the API was
        // briefly unreachable on cold start. The next request from any screen
        // will recover the canonical role naturally.
        const finalRole: UserRole =
          serverRole === "driver" || serverRole === "customer"
            ? serverRole
            : (get().role ?? "customer");

        set((state) => ({
          authed: true,
          accessToken: session.access_token,
          phone: session.user.phone ?? "",
          role: finalRole,
          // Drivers skip signup; customers retain whatever they had.
          signupDone:
            finalRole === "driver"
              ? true
              : state.signupDone || !!session.user.user_metadata?.name,
          sessionRestored: true,
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
        role: state.role,
      }),
    },
  ),
);

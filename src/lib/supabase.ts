import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ggjyxkofthmnwyjauwgd.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Module-scope mirror of the current access token. The api client reads this
// FIRST (without awaiting an async lock on the supabase client), then falls
// back to supabase.auth.getSession() if the mirror is empty. This eliminates a
// production race where the first fetches after signup raced ahead of supabase
// surfacing the freshly-set session, producing "Missing bearer token" 401s on
// /profile, /orders, /favorites and /notifications.
let currentAccessToken: string | null = null;

export function getCurrentAccessToken(): string | null {
  return currentAccessToken;
}

// Explicit setter for callers that just acquired a session (verifyOtp,
// restoreSession). onAuthStateChange below also keeps it in sync, but in
// release builds we've observed the SIGNED_IN event arriving *after* the React
// effect that fires the post-login API calls — the explicit setter closes
// that gap.
export function setCurrentAccessToken(token: string | null): void {
  currentAccessToken = token;
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentAccessToken = session?.access_token ?? null;
});

// Keep the access token auto-refreshing while the app is foregrounded. On React
// Native, supabase's refresh timer only runs when we drive it from AppState —
// without this, a token can expire and never refresh, which surfaced as backend
// "token is expired" 401s (REST) and dropped realtime subscriptions. We start
// it now (the app launches active) and toggle on every AppState change.
supabase.auth.startAutoRefresh();
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

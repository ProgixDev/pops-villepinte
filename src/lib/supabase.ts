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

supabase.auth.onAuthStateChange((_event, session) => {
  currentAccessToken = session?.access_token ?? null;
});

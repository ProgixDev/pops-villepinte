import "../../global.css";

import { useEffect, useState } from "react";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import AuthFlow from "@/components/auth/AuthFlow";
import AuthIndex from "@/components/auth/AuthIndex";
import DriverAuthFlow from "@/components/auth/DriverAuthFlow";
import SignupForm from "@/components/auth/SignupForm";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import AnimatedSplash from "@/components/splash/AnimatedSplash";
import { useAppFonts } from "@/constants/fonts";
import { ROUTES } from "@/constants/routes";
import { preloadFlowImages } from "@/lib/preloadImages";
import {
  ACTION_ACCEPT,
  ACTION_REFUSE,
  registerDriverPushAsync,
  registerForPushAsync,
} from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { driverApi, type NotificationData } from "@/lib/api";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";
import { useAuthStore } from "@/store/auth.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useMenuStore } from "@/store/menu.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useProfileStore } from "@/store/profile.store";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): React.ReactNode {
  const fontsLoaded = useAppFonts();
  // Splash dismisses only when ALL conditions hold:
  //   1. The logo video has finished (or errored / timed out).
  //   2. Zustand persist has finished hydrating from AsyncStorage.
  //   3. restoreSession() has resolved (sessionRestored === true).
  // The hydration gate is non-obvious but critical: AsyncStorage hydration is
  // async, and if it lands AFTER restoreSession's set(), it overwrites our
  // freshly-fetched server-truth role with whatever was last persisted. That
  // was the bug where a refreshed driver session kept landing on the customer
  // home — persisted role hydrated after restoreSession completed.
  const [splashAnimDone, setSplashAnimDone] = useState(false);
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  );

  const onboardingDone = useAuthStore((s) => s.onboardingDone);
  const authed = useAuthStore((s) => s.authed);
  const signupDone = useAuthStore((s) => s.signupDone);
  const authChoice = useAuthStore((s) => s.authChoice);
  const phone = useAuthStore((s) => s.phone);
  const role = useAuthStore((s) => s.role);
  const sessionRestored = useAuthStore((s) => s.sessionRestored);
  const splashDone = splashAnimDone && hydrated && sessionRestored;
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const completeSignup = useAuthStore((s) => s.completeSignup);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const fetchMenu = useMenuStore((s) => s.fetchMenu);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);
  const fetchFavorites = useFavoritesStore((s) => s.fetch);
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);
  const prependNotification = useNotificationsStore((s) => s.prepend);
  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Subscribe to zustand persist hydration. The store may already be hydrated
  // by the time this effect runs (synchronous hydration on subsequent mounts),
  // so we both check the current state and listen for future completion.
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsub();
  }, []);

  // Restore session AFTER hydration completes. Order matters: if we ran this
  // before hydration, AsyncStorage's later set() would clobber the server-
  // truth role we just fetched.
  useEffect(() => {
    if (!hydrated) return;
    void restoreSession();
    void fetchMenu();
    void preloadFlowImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Current URL segments. Drives the role-based guard below: a driver session
  // whose URL is still `/` (because expo-router restored the last customer
  // route, or `/` is the default) needs to be redirected into the driver
  // subtree before any customer screen paints.
  const segments = useSegments() as string[];
  const inDriverSubtree = segments[0] === "driver";

  // Fetch profile when user becomes authed. Customer-only — driver fetches
  // live in the driver screens, and these endpoints (favorites, customer
  // notifications, customer profile) aren't useful for the driver role.
  useEffect(() => {
    if (authed && role !== "driver") {
      void fetchProfile();
      void fetchNotifications();
      void fetchFavorites();
      void registerForPushAsync();
    }
    if (authed && role === "driver") {
      // Same Expo push token, different server endpoint (/driver/push-token).
      // Registration is what lets the backend's assignment push reach this
      // device, gated on the driver's is_active flag server-side.
      void registerDriverPushAsync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, role]);

  // Realtime: subscribe to my own notifications row inserts so new ones land
  // instantly without waiting for the OS push or a manual refresh. RLS limits
  // the inbound rows to the current user automatically.
  useEffect(() => {
    if (!authed) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      channel = supabase
        .channel(`notif-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              kind: "order" | "broadcast";
              title: string;
              body: string;
              order_id: string | null;
              data: Record<string, unknown>;
              read_at: string | null;
              created_at: string;
            };
            const n: NotificationData = {
              id: row.id,
              kind: row.kind,
              title: row.title,
              body: row.body,
              order_id: row.order_id,
              data: row.data ?? {},
              read_at: row.read_at,
              created_at: row.created_at,
            };
            prependNotification(n);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [authed, prependNotification]);

  // Foreground push → refresh badge + prepend to in-app list.
  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void refreshUnread();
      void fetchNotifications();
    });
    // Tap on a push (from anywhere) → if it's an order push, deep-link to it.
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (res) => {
        const data = res.notification.request.content.data as
          | { orderId?: string; kind?: string; assignmentId?: string }
          | undefined;
        if (data?.kind === "driver-assignment" && data.assignmentId) {
          const assignmentId = data.assignmentId;
          // Call-style action buttons on the assignment push. Accepter →
          // accept server-side and jump into navigation; Refuser → refuse and
          // stay put. A plain tap (no action) opens the accept/refuse sheet.
          if (res.actionIdentifier === ACTION_ACCEPT) {
            void driverApi
              .respond(assignmentId, "accepted")
              .then(() => {
                void useDeliveriesStore.getState().fetch();
                router.push(`/driver/navigate/${assignmentId}` as never);
              })
              .catch(() => {
                // Fall back to the sheet if the quick-accept failed.
                router.push(`/driver/assignment/${assignmentId}` as never);
              });
          } else if (res.actionIdentifier === ACTION_REFUSE) {
            void driverApi
              .respond(assignmentId, "refused")
              .then(() => void useDeliveriesStore.getState().fetch())
              .catch(() => {});
          } else {
            // New course for a driver → open the accept/refuse sheet directly.
            router.push(`/driver/assignment/${assignmentId}` as never);
          }
        } else if (data?.kind === "order" && data.orderId) {
          router.push({
            pathname: "/order/[id]",
            params: { id: data.orderId },
          });
        } else {
          // Typed-routes index regenerates on next `expo start`.
          router.push(ROUTES.notifications as never);
        }
      },
    );
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [refreshUnread, fetchNotifications, router]);

  if (!fontsLoaded) return null;

  if (!splashDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AnimatedSplash onComplete={() => setSplashAnimDone(true)} />
      </GestureHandlerRootView>
    );
  }

  if (!onboardingDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <OnboardingFlow onComplete={completeOnboarding} />
      </GestureHandlerRootView>
    );
  }

  if (!authed && !authChoice) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AuthIndex />
      </GestureHandlerRootView>
    );
  }

  if (!authed && authChoice === "driver-signin") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <DriverAuthFlow />
      </GestureHandlerRootView>
    );
  }

  if (!authed) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <AuthFlow
          onComplete={() => {
            // Auth is handled by the store's verifyOtp
          }}
        />
      </GestureHandlerRootView>
    );
  }

  // Drivers skip signup (they're admin-created with name already filled).
  // Without this guard, a driver with a stale signupDone=false in persisted
  // state would land on the customer-flavored SignupForm before reaching the
  // role branch below.
  if (!signupDone && role !== "driver") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <SignupForm phone={phone} onComplete={completeSignup} />
      </GestureHandlerRootView>
    );
  }

  // Role enforcement at the routing layer. Expo-router is URL-driven and will
  // happily render whichever screen the current URL resolves to, regardless
  // of what <Stack.Screen> elements we declare below. So we short-circuit
  // the render with <Redirect> whenever the current segments don't match the
  // authenticated role. This is what actually keeps a driver out of the
  // customer subtree (and vice versa).
  if (role === "driver" && !inDriverSubtree) {
    return <Redirect href={"/driver" as never} />;
  }
  if (role === "customer" && inDriverSubtree) {
    return <Redirect href="/" />;
  }

  if (role === "driver") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="driver" />
            <Stack.Screen name="settings/[slug]" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="product/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="cart" options={{ presentation: "modal" }} />
          <Stack.Screen name="checkout" />
          <Stack.Screen
            name="delivery-picker"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="notifications"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="settings/[slug]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

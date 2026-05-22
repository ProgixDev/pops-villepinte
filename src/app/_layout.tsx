import "../../global.css";

import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import AuthFlow from "@/components/auth/AuthFlow";
import AuthIndex from "@/components/auth/AuthIndex";
import SignupForm from "@/components/auth/SignupForm";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import AnimatedSplash from "@/components/splash/AnimatedSplash";
import { useAppFonts } from "@/constants/fonts";
import { ROUTES } from "@/constants/routes";
import { preloadFlowImages } from "@/lib/preloadImages";
import { registerForPushAsync } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import type { NotificationData } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useMenuStore } from "@/store/menu.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useProfileStore } from "@/store/profile.store";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): React.ReactNode {
  const fontsLoaded = useAppFonts();
  const [splashDone, setSplashDone] = useState(false);

  const onboardingDone = useAuthStore((s) => s.onboardingDone);
  const authed = useAuthStore((s) => s.authed);
  const signupDone = useAuthStore((s) => s.signupDone);
  const authChoice = useAuthStore((s) => s.authChoice);
  const phone = useAuthStore((s) => s.phone);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const completeSignup = useAuthStore((s) => s.completeSignup);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const fetchMenu = useMenuStore((s) => s.fetchMenu);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);
  const prependNotification = useNotificationsStore((s) => s.prepend);
  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Restore session and fetch menu on app start. Also kick off image
  // preloading so the onboarding/auth flow doesn't decode 7 large PNGs
  // simultaneously during a screen transition (OOM risk on low-end Android).
  useEffect(() => {
    void restoreSession();
    void fetchMenu();
    void preloadFlowImages();
  }, []);

  // Fetch profile when user becomes authed
  useEffect(() => {
    if (authed) {
      void fetchProfile();
      void fetchNotifications();
      void registerForPushAsync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

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
          | { orderId?: string; kind?: string }
          | undefined;
        if (data?.kind === "order" && data.orderId) {
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
        <AnimatedSplash onComplete={() => setSplashDone(true)} />
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

  if (!signupDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <SignupForm phone={phone} onComplete={completeSignup} />
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

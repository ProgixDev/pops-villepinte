import "../../global.css";

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import AuthFlow from "@/components/auth/AuthFlow";
import AuthIndex from "@/components/auth/AuthIndex";
import SignupForm from "@/components/auth/SignupForm";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import AnimatedSplash from "@/components/splash/AnimatedSplash";
import { useAppFonts } from "@/constants/fonts";
import { useAuthStore } from "@/store/auth.store";
import { useMenuStore } from "@/store/menu.store";
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Restore session and fetch menu on app start
  useEffect(() => {
    void restoreSession();
    void fetchMenu();
  }, []);

  // Fetch profile when user becomes authed
  useEffect(() => {
    if (authed) {
      void fetchProfile();
    }
  }, [authed]);

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
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="settings/[slug]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

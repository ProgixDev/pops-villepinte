import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { driverApi, notificationsApi } from "./api";

// Foreground behaviour — show the banner while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as Notifications.NotificationBehavior),
});

// Action-button category for driver-assignment pushes. Registering this makes
// the lock-screen / heads-up notification show "Accepter" and "Refuser"
// buttons (call-style), so the driver can respond without unlocking into the
// app. The button taps are handled by the response listener in app/_layout.tsx
// (it reads res.actionIdentifier). Identifiers MUST match there.
export const DRIVER_ASSIGNMENT_CATEGORY = "driver-assignment";
export const ACTION_ACCEPT = "accept";
export const ACTION_REFUSE = "refuse";

let categoriesRegistered = false;
export async function registerNotificationCategories(): Promise<void> {
  if (categoriesRegistered) return;
  categoriesRegistered = true;
  try {
    await Notifications.setNotificationCategoryAsync(
      DRIVER_ASSIGNMENT_CATEGORY,
      [
        {
          identifier: ACTION_ACCEPT,
          buttonTitle: "Accepter",
          options: { opensAppToForeground: true },
        },
        {
          identifier: ACTION_REFUSE,
          buttonTitle: "Refuser",
          options: { opensAppToForeground: true, isDestructive: true },
        },
      ],
    );
  } catch {
    // Non-fatal — the push still arrives, just without the buttons.
  }
}

let lastRegisteredToken: string | null = null;

export async function registerForPushAsync(): Promise<string | null> {
  // Simulators and the web target don't have notification hardware. Android
  // emulators also need a Google Play system image; without GMS this returns
  // early instead of throwing.
  if (!Device.isDevice) {
    if (__DEV__) console.log("[push] skipped — not a physical device");
    return null;
  }
  if (Platform.OS === "web") return null;

  // The NotificationPermissionsStatus type in expo-notifications doesn't
  // re-export the `status`/`granted` fields of its PermissionResponse parent
  // (multi-instance expo-modules-core resolution), so cast to read them.
  const isGranted = (
    p: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
  ): boolean =>
    (p as { granted?: boolean; status?: string }).granted === true ||
    (p as { status?: string }).status === "granted";

  let granted = isGranted(await Notifications.getPermissionsAsync());
  if (!granted) {
    granted = isGranted(await Notifications.requestPermissionsAsync());
  }
  if (!granted) {
    if (__DEV__) console.warn("[push] notification permission not granted");
    return null;
  }

  // Android requires an explicit channel.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Pop's Villepinte",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCE00",
    });
  }

  // Register the Accepter/Refuser action category (driver assignments).
  await registerNotificationCategories();

  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig?.projectId as string | undefined);

  if (!projectId && __DEV__) {
    console.warn(
      "[push] no EAS projectId resolved — getExpoPushTokenAsync may fail",
    );
  }

  let token: string | null = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = result.data;
  } catch (e) {
    if (__DEV__) console.warn("[push] getExpoPushTokenAsync failed", e);
    return null;
  }

  if (token && token !== lastRegisteredToken) {
    try {
      await notificationsApi.registerToken(
        token,
        Platform.OS === "ios" ? "ios" : "android",
      );
      lastRegisteredToken = token;
      if (__DEV__) console.log("[push] customer token registered", token);
    } catch (e) {
      // Token will be retried on the next app launch.
      if (__DEV__) console.warn("[push] registerToken API failed", e);
    }
  }
  return token;
}

let lastRegisteredDriverToken: string | null = null;

/**
 * Driver-flavored push registration. Same permission + Android channel + token
 * acquisition as registerForPushAsync(), but writes to /driver/push-token
 * instead of /profile/device-tokens. Drivers and customers can't both be
 * signed in on the same install, so we keep the two registration paths
 * separate (cleaner than a role-aware branch inside one function).
 */
export async function registerDriverPushAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) console.log("[push] driver skipped — not a physical device");
    return null;
  }
  if (Platform.OS === "web") return null;

  const isGranted = (
    p: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
  ): boolean =>
    (p as { granted?: boolean; status?: string }).granted === true ||
    (p as { status?: string }).status === "granted";

  let granted = isGranted(await Notifications.getPermissionsAsync());
  if (!granted) {
    granted = isGranted(await Notifications.requestPermissionsAsync());
  }
  if (!granted) {
    if (__DEV__) console.warn("[push] driver permission not granted");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Pop's Villepinte",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCE00",
    });
  }

  // Register the Accepter/Refuser action category so driver-assignment pushes
  // show the call-style buttons on the lock screen.
  await registerNotificationCategories();

  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig?.projectId as string | undefined);

  let token: string | null = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = result.data;
  } catch (e) {
    if (__DEV__) console.warn("[push] driver getExpoPushTokenAsync failed", e);
    return null;
  }

  if (token && token !== lastRegisteredDriverToken) {
    try {
      await driverApi.registerPushToken(token);
      lastRegisteredDriverToken = token;
      if (__DEV__) console.log("[push] driver token registered", token);
    } catch (e) {
      // Will be retried on the next app launch.
      if (__DEV__) console.warn("[push] driver registerPushToken failed", e);
    }
  }
  return token;
}

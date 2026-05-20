import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { notificationsApi } from "./api";

// Foreground behaviour — show the banner while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as Notifications.NotificationBehavior),
});

let lastRegisteredToken: string | null = null;

export async function registerForPushAsync(): Promise<string | null> {
  // Simulators and the web target don't have notification hardware. Android
  // emulators also need a Google Play system image; without GMS this returns
  // early instead of throwing.
  if (!Device.isDevice) return null;
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
  if (!granted) return null;

  // Android requires an explicit channel.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Pop's Villepinte",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFCE00",
    });
  }

  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig?.projectId as string | undefined);

  let token: string | null = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = result.data;
  } catch {
    return null;
  }

  if (token && token !== lastRegisteredToken) {
    try {
      await notificationsApi.registerToken(
        token,
        Platform.OS === "ios" ? "ios" : "android",
      );
      lastRegisteredToken = token;
    } catch {
      // Token will be retried on the next app launch.
    }
  }
  return token;
}

import * as Location from "expo-location";

// On iOS, handing Mapbox a <LocationPuck> while the foreground permission is
// still "undetermined" makes the native location component start a
// CLLocationManager that was never authorised — which hard-crashes the app.
// Every map screen that shows the user's position MUST therefore await
// `ensureLocationPermission()` and only render the puck once it resolves true.
// We request the permission proactively right after sign-in (home screen) so by
// the time the customer opens the address picker it is already granted.

let sessionRequest: Promise<boolean> | null = null;

/**
 * Make sure foreground location permission has been requested at least once and
 * return whether it is granted. Safe to call repeatedly: it only shows the OS
 * prompt while the status is still undetermined (or re-askable). Never throws.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === Location.PermissionStatus.GRANTED) return true;
    // Permanently denied — asking again is a no-op that only adds latency.
    if (
      current.status === Location.PermissionStatus.DENIED &&
      !current.canAskAgain
    ) {
      return false;
    }
    const res = await Location.requestForegroundPermissionsAsync();
    return res.status === Location.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Fire the permission request a single time per app session, deduping
 * concurrent callers. Used by the home screen so the prompt appears once after
 * sign-in rather than on first map open.
 */
export function requestLocationOncePerSession(): Promise<boolean> {
  if (!sessionRequest) sessionRequest = ensureLocationPermission();
  return sessionRequest;
}

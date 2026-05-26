import { useEffect, useRef } from "react";
import * as Location from "expo-location";

import { supabase } from "@/lib/supabase";

// Battery-conservative tracking — 20s minimum interval, 50m minimum
// displacement, balanced accuracy. Mapbox's UserLocation puck on the driver's
// own screen pulls fresh fixes more aggressively for the user puck; this hook
// is specifically about the OUTBOUND broadcast for the customer-side live map.
const TIME_INTERVAL_MS = 20_000;
const DISTANCE_INTERVAL_M = 50;

export type UseDriverLocationBroadcastOptions = {
  /**
   * `true` while there's an in-flight delivery (accepted + picked_up + not yet
   * delivered). When this flips to false, the hook tears down the location
   * watcher immediately so a parked-and-offline driver doesn't keep pinging.
   */
  active: boolean;
};

/**
 * Driver-side location broadcaster. Watches device GPS at battery-friendly
 * intervals and upserts to `public.driver_locations` so the customer's live
 * map can subscribe via Supabase Realtime.
 *
 * Lifecycle:
 *   - Mounts active=false: noop, no watcher started.
 *   - active flips to true: resolves the driver's auth.uid() from the current
 *     supabase session, requests foreground location permission (if not
 *     already granted), then starts watchPositionAsync. Each fix is upserted.
 *   - active flips to false (delivery completed / driver offline / unmount):
 *     watcher torn down, no pending writes.
 *
 * No effort is made to "flush" stale rows here — the customer's RLS policy
 * auto-revokes their visibility the moment delivered_at is set on the
 * assignment, so a stale row in the table has no observable effect.
 */
export function useDriverLocationBroadcast(
  options: UseDriverLocationBroadcastOptions,
): void {
  const { active } = options;
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!active) {
      // No-op when inactive. The cleanup in the previous-run effect (if any)
      // has already torn down the watcher.
      return;
    }

    let cancelled = false;

    void (async () => {
      // Resolve the driver's auth user id from the current supabase session.
      // The RLS policy keys the upsert on `auth.uid() = driver_id`, so this
      // must match or every write returns 403.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const driverId = user?.id;
      if (!driverId || cancelled) return;

      // Reuse the permission grant if one is already in place — avoids an
      // extra OS prompt on every active=true flip.
      const current = await Location.getForegroundPermissionsAsync();
      const granted =
        current.granted ||
        (await Location.requestForegroundPermissionsAsync()).granted;
      if (!granted || cancelled) return;

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: TIME_INTERVAL_MS,
          distanceInterval: DISTANCE_INTERVAL_M,
        },
        (loc) => {
          if (cancelled || !loc?.coords) return;
          const { latitude, longitude, heading, speed } = loc.coords;
          // speed is m/s from expo-location; convert to km/h for the row.
          const speedKmh =
            typeof speed === "number" && speed >= 0
              ? Number((speed * 3.6).toFixed(2))
              : null;
          void supabase
            .from("driver_locations")
            .upsert(
              {
                driver_id: driverId,
                lat: latitude,
                lng: longitude,
                heading:
                  typeof heading === "number" && heading >= 0
                    ? Number(heading.toFixed(2))
                    : null,
                speed_kmh: speedKmh,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "driver_id" },
            )
            .then(() => {});
        },
      );

      if (cancelled) {
        sub.remove();
        return;
      }
      subscriptionRef.current = sub;
    })();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [active]);
}

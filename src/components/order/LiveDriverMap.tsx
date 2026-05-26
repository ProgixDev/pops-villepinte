import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Camera, MapView, PointAnnotation } from "@rnmapbox/maps";
import { Bike, Clock, MapPin } from "lucide-react-native";

import { colors, font, shadow } from "@/constants/theme";
import { initMapbox } from "@/lib/mapbox";
import { supabase } from "@/lib/supabase";

const MAP_STYLE = "mapbox://styles/mapbox/navigation-day-v1";

// Treat the row as stale after this — the driver might be in a tunnel, app
// might be backgrounded, or the broadcast hook might have torn down. Showing
// a "ago" badge is more honest than a slowly drifting puck.
const STALE_AFTER_MS = 60_000;

// ETA refresh policy.
const ETA_REFRESH_INTERVAL_MS = 30_000;
// Skip refresh if the driver hasn't moved this far since the last ETA fetch —
// no point in burning a Directions request when the routing is unchanged.
const ETA_MIN_MOVE_M = 100;

// Marker animation: when a new fix arrives, tween the displayed pin from its
// last position to the new one over this duration. Matches the driver's
// 20s broadcast interval loosely — slow enough to look smooth, fast enough
// that the driver's stop-and-go shows up in roughly the right place.
const MARKER_TWEEN_MS = 1500;

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "";

initMapbox();

export type LiveDriverMapProps = {
  driverId: string;
  dropoffCoords: [number, number];
};

type LocationRow = {
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  updated_at: string;
};

type EtaState = {
  durationMin: number;
  fetchedAt: number;
  /** Driver coords at the time of the fetch — used by ETA_MIN_MOVE_M gate. */
  fromCoords: [number, number];
};

export default function LiveDriverMap({
  driverId,
  dropoffCoords,
}: LiveDriverMapProps): React.ReactElement {
  const cameraRef = useRef<Camera>(null);
  const [loc, setLoc] = useState<LocationRow | null>(null);
  const [eta, setEta] = useState<EtaState | null>(null);
  // 1s tick for the "stale" badge text / age computation.
  const [, setTick] = useState(0);

  // Displayed driver pin coords. Tweened toward `loc` whenever a new fix
  // arrives so the pin glides instead of teleporting between 20s pings.
  const [displayedCoords, setDisplayedCoords] = useState<
    [number, number] | null
  >(null);
  const tweenRafRef = useRef<number | null>(null);

  // Initial fetch + realtime subscription.
  useEffect(() => {
    let cancelled = false;

    void supabase
      .from("driver_locations")
      .select("*")
      .eq("driver_id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLoc(data as LocationRow);
      });

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | LocationRow
            | null
            | undefined;
          if (row && !cancelled) setLoc(row);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [driverId]);

  // 1s tick for the "stale" badge.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Smooth-tween the driver pin from its previous displayed coords to the new
  // target. Cancels any in-flight tween — if a new fix arrives mid-tween,
  // start fresh from wherever the pin currently is (no jump).
  useEffect(() => {
    if (!loc) return;
    const target: [number, number] = [loc.lng, loc.lat];

    if (!displayedCoords) {
      // First fix — just snap, nothing to tween from.
      setDisplayedCoords(target);
      return;
    }

    const start: [number, number] = displayedCoords;
    const t0 = Date.now();

    if (tweenRafRef.current != null) {
      cancelAnimationFrame(tweenRafRef.current);
    }

    const step = (): void => {
      const t = Math.min(1, (Date.now() - t0) / MARKER_TWEEN_MS);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const lng = start[0] + (target[0] - start[0]) * eased;
      const lat = start[1] + (target[1] - start[1]) * eased;
      setDisplayedCoords([lng, lat]);
      if (t < 1) {
        tweenRafRef.current = requestAnimationFrame(step);
      } else {
        tweenRafRef.current = null;
      }
    };
    tweenRafRef.current = requestAnimationFrame(step);

    return () => {
      if (tweenRafRef.current != null) {
        cancelAnimationFrame(tweenRafRef.current);
        tweenRafRef.current = null;
      }
    };
    // displayedCoords is intentionally excluded — including it would re-fire
    // this effect on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc]);

  // Frame the camera so both pins (driver + drop-off) are visible. Driven by
  // `loc` (the truth) rather than displayedCoords (mid-tween) so the camera
  // doesn't keep snapping on every animation frame.
  useEffect(() => {
    if (!loc || !cameraRef.current) return;
    const driverPt: [number, number] = [loc.lng, loc.lat];
    const ne: [number, number] = [
      Math.max(driverPt[0], dropoffCoords[0]),
      Math.max(driverPt[1], dropoffCoords[1]),
    ];
    const sw: [number, number] = [
      Math.min(driverPt[0], dropoffCoords[0]),
      Math.min(driverPt[1], dropoffCoords[1]),
    ];
    cameraRef.current.fitBounds(ne, sw, 60, 700);
  }, [loc, dropoffCoords]);

  // ETA fetcher — calls Mapbox Directions only when (a) we don't have an ETA
  // yet, (b) the existing one is older than ETA_REFRESH_INTERVAL_MS, AND the
  // driver has moved more than ETA_MIN_MOVE_M since the last fetch. The
  // distance gate keeps a parked driver from burning API quota.
  const refreshEta = useCallback(async () => {
    if (!loc || !MAPBOX_TOKEN) return;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${loc.lng},${loc.lat};${dropoffCoords[0]},${dropoffCoords[1]}` +
      `?access_token=${MAPBOX_TOKEN}&overview=false`;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const body = (await res.json()) as {
        routes?: { duration?: number }[];
      };
      const seconds = body.routes?.[0]?.duration;
      if (typeof seconds !== "number") return;
      setEta({
        durationMin: Math.max(1, Math.round(seconds / 60)),
        fetchedAt: Date.now(),
        fromCoords: [loc.lng, loc.lat],
      });
    } catch {
      // Network/Mapbox blip — keep showing the previous ETA. The next
      // refresh tick will retry.
    }
  }, [loc, dropoffCoords]);

  // Decide whether to refetch on each new location or each tick of the
  // 30s interval. We piggyback off the existing 1s `tick` so we don't need
  // a third interval — when the gate is open, fetch; otherwise skip.
  useEffect(() => {
    if (!loc) return;
    const shouldFetch = (() => {
      if (!eta) return true; // never fetched
      const stale = Date.now() - eta.fetchedAt >= ETA_REFRESH_INTERVAL_MS;
      const moved =
        haversineMeters(eta.fromCoords, [loc.lng, loc.lat]) >= ETA_MIN_MOVE_M;
      return stale && moved;
    })();
    if (shouldFetch) void refreshEta();
  }, [loc, eta, refreshEta]);

  const ageMs = useMemo(() => {
    if (!loc) return Number.POSITIVE_INFINITY;
    return Date.now() - new Date(loc.updated_at).getTime();
  }, [loc]);
  const isStale = ageMs > STALE_AFTER_MS;

  return (
    <View
      style={[
        {
          marginHorizontal: 24,
          marginTop: 16,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        shadow.card,
      ]}
    >
      <View style={{ height: 220 }}>
        <MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLE}
          scaleBarEnabled={false}
          logoEnabled={false}
          compassEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          attributionPosition={{ bottom: 4, left: 4 }}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: dropoffCoords,
              zoomLevel: 13,
            }}
          />

          <PointAnnotation
            id="customer-dropoff"
            coordinate={[...dropoffCoords] as [number, number]}
          >
            <View style={mapPinStyles.dropoff}>
              <MapPin size={14} color={colors.surface} strokeWidth={2.5} />
            </View>
          </PointAnnotation>

          {displayedCoords ? (
            <PointAnnotation id="driver" coordinate={displayedCoords}>
              <View style={mapPinStyles.driver}>
                <Bike size={16} color={colors.ink} strokeWidth={2.5} />
              </View>
            </PointAnnotation>
          ) : null}
        </MapView>

        {/* Status pill (top-left). */}
        <View
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: isStale ? colors.inkMuted : colors.success,
          }}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 10,
              letterSpacing: 1.5,
              color: colors.surface,
              textTransform: "uppercase",
            }}
          >
            {!loc
              ? "En attente du livreur…"
              : isStale
                ? `MAJ il y a ${formatAgo(ageMs)}`
                : "Livreur en route"}
          </Text>
        </View>

        {/* ETA badge (top-right) — only when we have a fresh ETA AND the
            location isn't stale (an old ETA on a stale location lies). */}
        {eta && !isStale ? (
          <View
            style={[
              {
                position: "absolute",
                top: 10,
                right: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: colors.ink,
              },
              shadow.card,
            ]}
          >
            <Clock size={12} color={colors.primary} strokeWidth={2.5} />
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 12,
                letterSpacing: 0.5,
                color: colors.primary,
              }}
            >
              ~{eta.durationMin} min
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function formatAgo(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / 3_600_000)} h`;
}

function haversineMeters(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371_000;
  const toRad = (x: number): number => (x * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const mapPinStyles = {
  driver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: colors.ink,
    ...shadow.card,
  },
  dropoff: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 2.5,
    borderColor: colors.surface,
    ...shadow.card,
  },
};

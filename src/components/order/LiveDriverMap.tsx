import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Camera, MapView, PointAnnotation } from "@rnmapbox/maps";
import { Bike, MapPin } from "lucide-react-native";

import { colors, font, shadow } from "@/constants/theme";
import { initMapbox } from "@/lib/mapbox";
import { supabase } from "@/lib/supabase";

const MAP_STYLE = "mapbox://styles/mapbox/navigation-day-v1";

// Treat the row as stale after this — the driver might be in a tunnel, app
// might be backgrounded, or the broadcast hook might have torn down. Showing
// a "ago" badge is more honest than a slowly drifting puck.
const STALE_AFTER_MS = 60_000;

initMapbox();

export type LiveDriverMapProps = {
  /** The driver currently delivering this order. From the order assignment. */
  driverId: string;
  /** Customer drop-off coordinates [lng, lat]. */
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

/**
 * Real-time driver location map for the customer's order screen. Subscribes
 * to Supabase Realtime postgres_changes on `driver_locations` filtered by the
 * specific driver_id. RLS already gates this — the customer can only see the
 * row while the assignment is accepted + not delivered.
 *
 * Layout: 220px-tall card with the map, plus a stale-badge overlay when the
 * last update is older than STALE_AFTER_MS. Camera fits both the driver and
 * the customer drop-off pins with 60px padding.
 */
export default function LiveDriverMap({
  driverId,
  dropoffCoords,
}: LiveDriverMapProps): React.ReactElement {
  const cameraRef = useRef<Camera>(null);
  const [loc, setLoc] = useState<LocationRow | null>(null);
  // Forces a 1s tick to re-evaluate "is the latest row stale?". Cheap — only
  // affects the badge text and color, not the map render.
  const [, setTick] = useState(0);

  // Initial fetch + realtime subscription.
  useEffect(() => {
    let cancelled = false;

    // Seed with the latest known row so the customer sees the driver
    // immediately on screen open (instead of waiting for the next 20s ping).
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

  // Frame the camera so both pins (driver + drop-off) are visible.
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
          // Customer view is informational — disable interaction so the user
          // can't accidentally pan away and get confused.
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

          {loc ? (
            <PointAnnotation
              id="driver"
              coordinate={[loc.lng, loc.lat]}
            >
              <View style={mapPinStyles.driver}>
                <Bike size={16} color={colors.ink} strokeWidth={2.5} />
              </View>
            </PointAnnotation>
          ) : null}
        </MapView>

        {/* Status pill (top-left) — green when fresh, grey when stale. */}
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
      </View>
    </View>
  );
}

function formatAgo(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / 3_600_000)} h`;
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

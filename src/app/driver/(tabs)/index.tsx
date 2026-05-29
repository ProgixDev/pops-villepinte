import { useEffect, useMemo, useRef, useState } from "react";
import {
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  MapView,
  MarkerView,
  UserLocation,
} from "@rnmapbox/maps";
import { LocateFixed, MapPin, Package } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import BottomSheet from "@/components/driver/BottomSheet";
import DeliveryCard from "@/components/driver/delivery/DeliveryCard";
import DeliveryStatusPill from "@/components/driver/delivery/DeliveryStatusPill";
import OnlineSwitch from "@/components/driver/delivery/OnlineSwitch";
import { colors, font, shadow } from "@/constants/theme";
import { STORE_LAT, STORE_LNG } from "@/lib/delivery";
import { initMapbox } from "@/lib/mapbox";
import { formatPriceEUR } from "@/lib/format";
import {
  selectActiveDelivery,
  selectAssignedDeliveries,
  useDeliveriesStore,
} from "@/store/driver/deliveries.store";
import { useEarningsStore } from "@/store/driver/earnings.store";
import { useDriverProfileStore } from "@/store/driver/profile.store";

// Driver-optimized Mapbox style: white background, high-contrast roads, POI
// labels suppressed. Same family as the navigate/[id] turn-by-turn screen so
// the visual transition is seamless.
const DRIVER_MAP_STYLE = "mapbox://styles/mapbox/navigation-day-v1";

const POPS_COORDS: [number, number] = [STORE_LNG, STORE_LAT];

initMapbox();

export default function DriverHomeScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);

  const profile = useDriverProfileStore((s) => s.profile);
  const online = useDriverProfileStore((s) => s.online);
  const toggleOnline = useDriverProfileStore((s) => s.toggleOnline);
  const fetchProfile = useDriverProfileStore((s) => s.fetch);

  const active = useDeliveriesStore(selectActiveDelivery);
  const assigned = useDeliveriesStore(useShallow(selectAssignedDeliveries));
  const fetchDeliveries = useDeliveriesStore((s) => s.fetch);

  const today = useEarningsStore((s) => s.today);
  const fetchEarnings = useEarningsStore((s) => s.fetchAll);

  // Live driver coordinates from rnmapbox's UserLocation. `null` until the
  // first GPS fix arrives (or if location permission is denied). The recenter
  // button is disabled while this is null.
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  // Defer mounting the native <MapView> until the screen-entry transition has
  // settled. Mounting a heavy Fabric native view (the map) on the JS thread
  // *while* React Navigation's native-driven "shift" tab transition is doing a
  // synchronous view update on the main thread deadlocks the two threads on the
  // Fabric ComponentDescriptorRegistry lock — a hard freeze on iOS. The client
  // side never hits this because its first tab has no map. runAfterInteractions
  // lets the transition release the UI thread before we commit the map.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setMapReady(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    void fetchProfile();
    void fetchDeliveries();
    void fetchEarnings();
    // Request foreground location permission up-front. rnmapbox's
    // <UserLocation> would also trigger this implicitly when it tries to
    // start its location provider, but doing it explicitly here gives a more
    // deterministic prompt (some Android OEMs delay the implicit one until
    // the map's location service spins up). If the user denies, the map
    // still works — they just won't see the puck.
    void Location.requestForegroundPermissionsAsync().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenterOnUser = (): void => {
    if (!userCoords) return;
    Haptics.selectionAsync().catch(() => {});
    cameraRef.current?.setCamera({
      centerCoordinate: userCoords,
      zoomLevel: 15.5,
      animationDuration: 600,
    });
  };

  // Auto-center on the driver once on first GPS fix. After that, the camera
  // is driven by either the user (panning), the cameraFit memo (active
  // delivery bounds), or the recenter button. We don't want to keep pulling
  // the camera back to the driver every location update — that fights with
  // manual panning.
  const didInitialCenterRef = useRef(false);
  useEffect(() => {
    if (didInitialCenterRef.current) return;
    if (!userCoords) return;
    didInitialCenterRef.current = true;
    // Skip if there's an active delivery — the cameraFit effect below will
    // frame the route, which is more useful than centering on the driver.
    if (active) return;
    cameraRef.current?.setCamera({
      centerCoordinate: userCoords,
      zoomLevel: 15.5,
      animationDuration: 600,
    });
  }, [userCoords, active]);

  // Frame the map on POP'S + the active dropoff (if any). Recomputes only
  // when the active dropoff coordinates change.
  const cameraFit = useMemo<{
    centerCoordinate: [number, number];
    zoomLevel: number;
    bounds?: { ne: [number, number]; sw: [number, number]; padding: number };
  }>(() => {
    if (active && active.dropoff.coordinates[0] !== 0) {
      const [lng, lat] = active.dropoff.coordinates;
      const ne: [number, number] = [
        Math.max(POPS_COORDS[0], lng),
        Math.max(POPS_COORDS[1], lat),
      ];
      const sw: [number, number] = [
        Math.min(POPS_COORDS[0], lng),
        Math.min(POPS_COORDS[1], lat),
      ];
      return {
        centerCoordinate: POPS_COORDS,
        zoomLevel: 13,
        bounds: { ne, sw, padding: 80 },
      };
    }
    return { centerCoordinate: POPS_COORDS, zoomLevel: 13 };
  }, [active]);

  useEffect(() => {
    if (cameraFit.bounds) {
      cameraRef.current?.fitBounds(
        cameraFit.bounds.ne,
        cameraFit.bounds.sw,
        cameraFit.bounds.padding,
        600,
      );
    } else {
      cameraRef.current?.setCamera({
        centerCoordinate: cameraFit.centerCoordinate,
        zoomLevel: cameraFit.zoomLevel,
        animationDuration: 600,
      });
    }
  }, [cameraFit]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {mapReady ? (
        <MapView
          style={{ flex: 1 }}
          styleURL={DRIVER_MAP_STYLE}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionPosition={{ bottom: 8, left: 8 }}
          compassEnabled={false}
        >
          <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: POPS_COORDS,
            zoomLevel: 13,
          }}
        />
        <UserLocation
          visible
          androidRenderMode="normal"
          // Push every meter of movement up to JS. UserLocation pulls fresh
          // fixes from the OS location provider continuously; we just want
          // the latest coord for the recenter button + future "fit bounds
          // including driver" enhancements.
          minDisplacement={1}
          onUpdate={(loc) => {
            if (!loc?.coords) return;
            setUserCoords([loc.coords.longitude, loc.coords.latitude]);
          }}
        />

        <MarkerView
          coordinate={POPS_COORDS}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap
        >
          <View style={mapStyles.pickupPin}>
            <Package size={16} color={colors.ink} strokeWidth={2.5} />
          </View>
        </MarkerView>

        {active && active.dropoff.coordinates[0] !== 0 ? (
          <MarkerView
            coordinate={[...active.dropoff.coordinates] as [number, number]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <View style={mapStyles.dropoffPin}>
              <MapPin size={16} color={colors.surface} strokeWidth={2.5} />
            </View>
          </MarkerView>
        ) : null}
        </MapView>
      ) : null}

      {/* Floating header — greeting + compact online toggle */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 12,
          left: 16,
          right: 16,
        }}
      >
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 16,
              backgroundColor: colors.surface,
            },
            shadow.card,
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 10,
                letterSpacing: 2,
                color: colors.inkMuted,
                textTransform: "uppercase",
              }}
            >
              Tournée · {profile.name || "Livreur"}
            </Text>
            <Text
              style={{
                fontFamily: font.bodySemi,
                fontSize: 13,
                color: colors.ink,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {online
                ? "Tu es en ligne. On t'envoie une course."
                : "Touche le bouton pour démarrer."}
            </Text>
          </View>

          <OnlineSwitch online={online} onToggle={() => void toggleOnline()} />
        </View>
      </View>

      {/* Recenter-on-driver floating button. Sits just above the bottom
          sheet's peek height; gets covered when the sheet is dragged up,
          which is fine — the user has already pivoted away from the map.
          Tap is a no-op until we have a GPS fix; once the puck appears the
          button just works. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recentrer la carte sur ma position"
        onPress={recenterOnUser}
        style={({ pressed }) => [
          {
            position: "absolute",
            right: 16,
            bottom: 180 + 16, // peek height + margin
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          },
          shadow.card,
        ]}
      >
        <LocateFixed size={22} color={colors.ink} strokeWidth={2.5} />
      </Pressable>

      {/* Draggable bottom sheet — peek by default, drag up for the list */}
      <BottomSheet snapPoints={[180, 380, 640]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          {/* Stats row — always visible at peek height */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <Stat
              label="Aujourd'hui"
              value={formatPriceEUR(today.amountEUR)}
              accent
            />
            <View
              style={{
                width: 1,
                alignSelf: "stretch",
                backgroundColor: colors.border,
              }}
            />
            <Stat label="Courses" value={String(today.deliveries)} />
            <View
              style={{
                width: 1,
                alignSelf: "stretch",
                backgroundColor: colors.border,
              }}
            />
            <Stat
              label="Disponibles"
              value={String(assigned.length)}
              highlight={online && assigned.length > 0}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + 100, // clear the floating tab bar
          }}
          showsVerticalScrollIndicator={false}
        >
          {active ? (
            <>
              <SectionHeader title="En cours" />
              <DeliveryCard
                delivery={active}
                onPress={() =>
                  router.push(`/driver/delivery/${active.id}` as never)
                }
              />
            </>
          ) : null}

          <SectionHeader
            title={online ? "Disponibles" : "En attente"}
            trailing={
              !online ? (
                <DeliveryStatusPill status="cancelled" />
              ) : null
            }
          />

          {assigned.length === 0 ? (
            <View
              style={{
                marginHorizontal: 20,
                padding: 20,
                borderRadius: 12,
                backgroundColor: "#F5F5F5",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: font.bodySemi,
                  fontSize: 13,
                  color: colors.inkMuted,
                  textAlign: "center",
                }}
              >
                {online
                  ? "Aucune course pour l'instant.\nOn te ping dès qu'une commande tombe."
                  : "Passe en ligne pour recevoir des courses."}
              </Text>
            </View>
          ) : (
            assigned.map((d) => (
              <DeliveryCard
                key={d.id}
                delivery={d}
                onPress={() =>
                  router.push(`/driver/assignment/${d.id}` as never)
                }
              />
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  accent?: boolean;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: font.bodyBold,
          fontSize: 9,
          letterSpacing: 2,
          color: colors.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "BebasNeue_400Regular",
          fontSize: 30,
          letterSpacing: -1,
          color: accent
            ? colors.accent
            : highlight
              ? colors.success
              : colors.ink,
          marginTop: 2,
          lineHeight: 32,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 10,
      }}
    >
      <Text
        style={{
          fontFamily: font.bodyBold,
          fontSize: 10,
          letterSpacing: 2,
          color: colors.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

const mapStyles = {
  pickupPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: colors.ink,
    ...shadow.card,
  },
  dropoffPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.card,
  },
};

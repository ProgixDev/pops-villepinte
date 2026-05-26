import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";

import { colors, shadow } from "@/constants/theme";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";
import type { LngLat } from "@/types/driver";

// Mock driver origin near POP'S Villepinte. Used during development so the
// turn-by-turn flow works on the simulator without a real GPS fix. Replace
// with expo-location once Phase 6 wires background location.
const MOCK_DRIVER_ORIGIN: LngLat = [2.535, 48.958];

const MAPBOX_PUBLIC_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "";

// Lazy-resolve the native module so the screen still renders a graceful
// fallback in Expo Go (where native modules aren't linked) and before the
// Phase 5 install adds the package.
type MapboxNavigationViewProps = {
  coordinates: { latitude: number; longitude: number }[];
  useRouteMatchingApi?: boolean;
  travelMode?: "driving" | "driving-traffic" | "cycling" | "walking";
  language?: string;
  units?: "metric" | "imperial";
  mute?: boolean;
  routeProfile?: string;
  onArrive?: () => void;
  onCancelNavigation?: () => void;
  style?: object;
};

let MapboxNavigationView:
  | React.ComponentType<MapboxNavigationViewProps>
  | null = null;
let mapboxNavigationLoadError: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@badatgil/expo-mapbox-navigation");
  MapboxNavigationView = mod.MapboxNavigationView ?? mod.default ?? null;
} catch (err) {
  mapboxNavigationLoadError =
    err instanceof Error ? err.message : "Module Mapbox introuvable";
}

export default function DriverNavigateScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const delivery = useDeliveriesStore((s) => (id ? s.byId[id] : undefined));

  // EXPERIMENTAL: hardcoded driver origin instead of GPS. Lets the
  // turn-by-turn UI run on the simulator without permission plumbing.
  const origin: LngLat = MOCK_DRIVER_ORIGIN;

  // Pickup vs. dropoff routing: if not yet picked up, navigate to restaurant;
  // otherwise navigate to the customer.
  const destination: LngLat | undefined = useMemo(() => {
    if (delivery === undefined) return undefined;
    if (delivery.status === "picked_up") return delivery.dropoff.coordinates;
    return delivery.pickup.coordinates;
  }, [delivery]);

  if (delivery === undefined || destination === undefined) {
    return (
      <Fallback message="Course introuvable." onClose={() => router.back()} />
    );
  }

  if (MAPBOX_PUBLIC_TOKEN === "") {
    return (
      <Fallback
        message="Token Mapbox manquant. Ajoute EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN dans ton .env."
        onClose={() => router.back()}
      />
    );
  }

  if (mapboxNavigationLoadError !== null || MapboxNavigationView === null) {
    return (
      <Fallback
        message={
          "Le module de navigation natif n'est pas installé.\n" +
          "Lance `expo prebuild --clean` puis `expo run:ios` ou `expo run:android`.\n\n" +
          (mapboxNavigationLoadError ?? "")
        }
        onClose={() => router.back()}
      />
    );
  }

  const NavView = MapboxNavigationView;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <NavView
        style={{ flex: 1 }}
        coordinates={[
          { longitude: origin[0], latitude: origin[1] },
          { longitude: destination[0], latitude: destination[1] },
        ]}
        travelMode="driving-traffic"
        language="fr"
        units="metric"
        onArrive={() => router.back()}
        onCancelNavigation={() => router.back()}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer la navigation"
        onPress={() => router.back()}
        style={[
          {
            position: "absolute",
            top: 56,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          },
          shadow.float,
        ]}
      >
        <X size={20} color={colors.ink} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function Fallback({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: 32,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 11,
          letterSpacing: 3,
          color: colors.inkMuted,
          textTransform: "uppercase",
        }}
      >
        Navigation
      </Text>
      <Text
        style={{
          fontFamily: "BebasNeue_400Regular",
          fontSize: 44,
          letterSpacing: -1.5,
          color: colors.ink,
          marginTop: 12,
          lineHeight: 48,
        }}
      >
        On ne peut pas démarrer.
      </Text>
      <Text
        style={{
          fontFamily: "Poppins_500Medium",
          fontSize: 14,
          lineHeight: 22,
          color: colors.inkMuted,
          marginTop: 16,
        }}
      >
        {message}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        onPress={onClose}
        style={({ pressed }) => ({
          marginTop: 32,
          backgroundColor: colors.ink,
          borderRadius: 16,
          paddingVertical: 18,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.9 : 1,
          ...shadow.card,
        })}
      >
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 14,
            letterSpacing: 2,
            color: colors.primary,
            textTransform: "uppercase",
          }}
        >
          Fermer
        </Text>
      </Pressable>
    </View>
  );
}

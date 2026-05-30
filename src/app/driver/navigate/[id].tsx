import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, LifeBuoy, Phone, Volume2, VolumeX, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { colors, shadow } from "@/constants/theme";
import { STORE_LAT, STORE_LNG } from "@/lib/delivery";
import { formatDistanceMeters, formatDurationMinutes } from "@/lib/format";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";
import { useEarningsStore } from "@/store/driver/earnings.store";
import { useMenuStore } from "@/store/menu.store";
import type { LngLat } from "@/types/driver";

const MAPBOX_PUBLIC_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "";

// If we can't get a GPS fix (simulator, denied permission), fall back to the
// storefront — the driver starts there anyway in the parked-at-restaurant model.
const STORE_ORIGIN: LngLat = [STORE_LNG, STORE_LAT];

type ProgressEvent = {
  distanceRemaining: number; // meters
  durationRemaining: number; // seconds
  distanceTraveled: number;
  fractionTraveled: number;
};

// Props actually supported by @badatgil/expo-mapbox-navigation (see its
// ExpoMapboxNavigation.types). The previously-used travelMode/language/units/
// onArrive props were not real and were silently ignored.
type MapboxNavigationViewProps = {
  coordinates: { latitude: number; longitude: number }[];
  routeProfile?: string;
  locale?: string;
  mute?: boolean;
  initialLocation?: { latitude: number; longitude: number; zoom?: number };
  onRouteProgressChanged?: (e: { nativeEvent: ProgressEvent }) => void;
  onFinalDestinationArrival?: () => void;
  onCancelNavigation?: () => void;
  onRouteFailedToLoad?: (e: { nativeEvent: { errorMessage: string } }) => void;
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
  const insets = useSafeAreaInsets();

  const delivery = useDeliveriesStore((s) => (id ? s.byId[id] : undefined));
  const fetchDeliveries = useDeliveriesStore((s) => s.fetch);
  const markDelivered = useDeliveriesStore((s) => s.markDelivered);
  const refreshEarnings = useEarningsStore((s) => s.fetchAll);
  const supportPhone = useMenuStore((s) => s.shopSettings?.support_phone);

  // Real GPS origin for the route start. Falls back to the storefront if the
  // fix is unavailable (simulator / denied permission).
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [arrived, setArrived] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pull this assignment into the store if we arrived here directly (e.g.
  // accept → navigate straight from the push/assignment sheet, which doesn't
  // populate the deliveries store).
  useEffect(() => {
    if (id && !delivery) void fetchDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        const granted =
          perm.granted ||
          (await Location.requestForegroundPermissionsAsync()).granted;
        if (!granted) {
          if (!cancelled) setOrigin(STORE_ORIGIN);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setOrigin([pos.coords.longitude, pos.coords.latitude]);
        }
      } catch {
        if (!cancelled) setOrigin(STORE_ORIGIN);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Defer mounting the heavy native view until the screen transition settles
  // (same Fabric/UI-thread deadlock guard as the home map).
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setNavReady(true);
    });
    return () => task.cancel();
  }, []);

  const destination: LngLat | undefined = useMemo(() => {
    if (delivery === undefined) return undefined;
    const [lng, lat] = delivery.dropoff.coordinates;
    if (!lng || !lat) return undefined; // no client location on the order
    return delivery.dropoff.coordinates;
  }, [delivery]);

  const callCustomer = useCallback(() => {
    if (!delivery?.customerPhone) return;
    Linking.openURL(
      `tel:${delivery.customerPhone.replace(/\s+/g, "")}`,
    ).catch(() => {});
  }, [delivery]);

  const callSupport = useCallback(() => {
    if (!supportPhone) return;
    Linking.openURL(`tel:${supportPhone.replace(/\s+/g, "")}`).catch(() => {});
  }, [supportPhone]);

  const onDelivered = useCallback(async () => {
    if (!delivery || busy) return;
    try {
      setBusy(true);
      await markDelivered(delivery.id);
      void refreshEarnings();
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }, [delivery, busy, markDelivered, refreshEarnings, router]);

  // ── Guards ──
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
  if (delivery === undefined) {
    return <Loading onClose={() => router.back()} />;
  }
  if (destination === undefined) {
    return (
      <Fallback
        message="Cette commande n'a pas d'adresse GPS client. Impossible de lancer la navigation."
        onClose={() => router.back()}
      />
    );
  }

  const NavView = MapboxNavigationView;
  const etaMin =
    progress != null
      ? Math.max(1, Math.round(progress.durationRemaining / 60))
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {navReady && origin != null ? (
        <NavView
          style={{ flex: 1 }}
          coordinates={[
            { longitude: origin[0], latitude: origin[1] },
            { longitude: destination[0], latitude: destination[1] },
          ]}
          initialLocation={{
            longitude: origin[0],
            latitude: origin[1],
            zoom: 15,
          }}
          routeProfile="driving-traffic"
          locale="fr"
          mute={muted}
          onRouteProgressChanged={(e) => setProgress(e.nativeEvent)}
          onFinalDestinationArrival={() => {
            setArrived(true);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
          }}
          onCancelNavigation={() => router.back()}
          onRouteFailedToLoad={(e) =>
            Alert.alert(
              "Itinéraire indisponible",
              e.nativeEvent.errorMessage || "Réessaie dans un instant.",
            )
          }
        />
      ) : (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={colors.surface} />
        </View>
      )}

      {/* Top controls — mute toggle (left) + close (right) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? "Activer le son" : "Couper le son"}
        onPress={() => setMuted((m) => !m)}
        style={[topBtn(insets.top, "left"), shadow.float]}
      >
        {muted ? (
          <VolumeX size={20} color={colors.ink} strokeWidth={2.5} />
        ) : (
          <Volume2 size={20} color={colors.ink} strokeWidth={2.5} />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer la navigation"
        onPress={() => router.back()}
        style={[topBtn(insets.top, "right"), shadow.float]}
      >
        <X size={20} color={colors.ink} strokeWidth={2.5} />
      </Pressable>

      {/* Branded bottom card — customer + live ETA + actions */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <View
          style={[
            {
              margin: 12,
              marginBottom: insets.bottom + 12,
              padding: 16,
              borderRadius: 20,
              backgroundColor: colors.surface,
            },
            shadow.float,
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text
                style={{
                  fontFamily: "Poppins_700Bold",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: arrived ? colors.success : colors.inkMuted,
                  textTransform: "uppercase",
                }}
              >
                {arrived ? "Arrivé · Remets la commande" : "Livraison en cours"}
              </Text>
              <Text
                style={{
                  fontFamily: "BebasNeue_400Regular",
                  fontSize: 30,
                  letterSpacing: -0.5,
                  color: colors.ink,
                  marginTop: 2,
                  lineHeight: 32,
                }}
                numberOfLines={1}
              >
                {delivery.customerName || "Client"}
              </Text>
              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  fontSize: 13,
                  color: colors.inkMuted,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {delivery.dropoff.line1}
              </Text>
            </View>

            {!arrived && etaMin != null ? (
              <View
                style={{
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: colors.ink,
                }}
              >
                <Text
                  style={{
                    fontFamily: "BebasNeue_400Regular",
                    fontSize: 26,
                    color: colors.primary,
                    lineHeight: 28,
                  }}
                >
                  {formatDurationMinutes(etaMin)}
                </Text>
                {progress != null ? (
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {formatDistanceMeters(progress.distanceRemaining)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <SquareBtn
              icon={<Phone size={18} color={colors.ink} strokeWidth={2.5} />}
              onPress={callCustomer}
              accessibilityLabel="Appeler le client"
            />
            {supportPhone ? (
              <SquareBtn
                icon={
                  <LifeBuoy size={18} color={colors.ink} strokeWidth={2.5} />
                }
                onPress={callSupport}
                accessibilityLabel="Appeler le support"
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Marquer comme livrée"
              onPress={onDelivered}
              disabled={busy}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 52,
                borderRadius: 14,
                backgroundColor: colors.success,
                opacity: pressed || busy ? 0.85 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Check size={18} color={colors.surface} strokeWidth={2.5} />
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 13,
                      letterSpacing: 1,
                      color: colors.surface,
                      textTransform: "uppercase",
                    }}
                  >
                    Livrée
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function topBtn(top: number, side: "left" | "right") {
  return {
    position: "absolute" as const,
    top: top + 12,
    [side]: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

function SquareBtn({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon}
    </Pressable>
  );
}

function Loading({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.ink,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <ActivityIndicator color={colors.surface} />
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={16}>
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Annuler
        </Text>
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

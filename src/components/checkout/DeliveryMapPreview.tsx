import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Mapbox, {
  Camera,
  LocationPuck,
  MapView,
  PointAnnotation,
} from "@rnmapbox/maps";
import * as Location from "expo-location";
import { MapPin, Navigation } from "lucide-react-native";

import { colors, font, radius } from "@/constants/theme";
import {
  STORE_LAT,
  STORE_LNG,
  type DeliveryAddress,
} from "@/lib/delivery";
import { MAPBOX_STYLE_STREETS, initMapbox } from "@/lib/mapbox";

initMapbox();

export type DeliveryMapPreviewProps = {
  selected: DeliveryAddress | null;
  height?: number;
  onPress: (initial: { lat: number; lng: number } | null) => void;
};

export default function DeliveryMapPreview({
  selected,
  height = 200,
  onPress,
}: DeliveryMapPreviewProps): React.ReactElement {
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const cameraRef = useRef<Camera>(null);

  // Pull a one-shot device fix so the preview can centre on the user. We do
  // not stream updates — a frozen preview is enough; the picker route will
  // start its own session if needed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) setPermissionDenied(true);
          return;
        }
        const pos = await Location.getLastKnownPositionAsync().catch(() => null);
        if (pos && !cancelled) {
          setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } else {
          // Fall back to a fresh fix if no cached one is available.
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null);
          if (fresh && !cancelled) {
            setMe({ lat: fresh.coords.latitude, lng: fresh.coords.longitude });
          }
        }
      } catch {
        if (!cancelled) setPermissionDenied(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const center = useMemo(() => {
    if (selected) return { lat: selected.lat, lng: selected.lng };
    if (me) return me;
    return { lat: STORE_LAT, lng: STORE_LNG };
  }, [selected, me]);

  return (
    <Pressable
      onPress={() => onPress(me ?? null)}
      accessibilityRole="button"
      accessibilityLabel="Ouvrir la carte pour choisir une adresse"
      style={{
        height,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#E6E2D7",
        position: "relative",
      }}
    >
      <MapView
        style={{ flex: 1 }}
        styleURL={MAPBOX_STYLE_STREETS}
        compassEnabled={false}
        scaleBarEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={selected ? 15 : me ? 14 : 13}
          centerCoordinate={[center.lng, center.lat]}
          animationMode="none"
        />
        {!selected && me ? <LocationPuck visible /> : null}
        {selected ? (
          <PointAnnotation
            id="selected-pin"
            coordinate={[selected.lng, selected.lat]}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.accent,
                borderWidth: 3,
                borderColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPin size={14} color={colors.white} strokeWidth={2.5} />
            </View>
          </PointAnnotation>
        ) : null}
      </MapView>

      {/* Top-left status chip */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: colors.white,
          borderRadius: 999,
          shadowColor: colors.ink,
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Navigation size={12} color={colors.ink} strokeWidth={2.5} />
        <Text
          style={{
            fontFamily: font.bodyBold,
            fontSize: 10,
            letterSpacing: 1,
            color: colors.ink,
            textTransform: "uppercase",
          }}
        >
          {selected
            ? "Adresse choisie"
            : me
              ? "Ta position"
              : permissionDenied
                ? "Localisation refusée"
                : "Villepinte"}
        </Text>
      </View>

      {/* Tap-to-open CTA */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          backgroundColor: "rgba(17,17,17,0.85)",
          borderRadius: radius.lg,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MapPin size={14} color={colors.ink} strokeWidth={2.5} />
        </View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: font.bodyBold,
            fontSize: 12,
            color: colors.white,
            letterSpacing: 0.5,
          }}
        >
          {selected ? "Modifier sur la carte" : "Choisir mon adresse sur la carte"}
        </Text>
        <Text
          style={{
            fontFamily: font.bodyBold,
            fontSize: 11,
            color: colors.primary,
            letterSpacing: 1.5,
          }}
        >
          OUVRIR
        </Text>
      </View>
    </Pressable>
  );
}

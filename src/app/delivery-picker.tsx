import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Camera,
  LocationPuck,
  MapView,
  type MapState,
} from "@rnmapbox/maps";

type CameraHandle = {
  setCamera: (
    config: {
      centerCoordinate: [number, number];
      zoomLevel?: number;
      animationDuration?: number;
    },
  ) => void;
};
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  CornerDownLeft,
  Crosshair,
  MapPin,
  Search,
  X,
} from "lucide-react-native";

import { colors, font, radius, shadow } from "@/constants/theme";
import {
  DEFAULT_DELIVERY_BASE_FEE_EUR,
  DEFAULT_DELIVERY_PER_KM_EUR,
  STORE_LAT,
  STORE_LNG,
  computeDeliveryFee,
  distanceFromStoreKm,
  type DeliveryAddress,
} from "@/lib/delivery";
import { useMenuStore } from "@/store/menu.store";
import {
  MAPBOX_STYLE_STREETS,
  initMapbox,
  mapboxReverseGeocode,
  mapboxSearch,
} from "@/lib/mapbox";
import { useDeliveryDraftStore } from "@/store/deliveryDraft.store";

initMapbox();

export default function DeliveryPickerScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const setPicked = useDeliveryDraftStore((s) => s.setPicked);

  const cameraRef = useRef<CameraHandle | null>(null);
  const lastReverseSeq = useRef(0);
  const lastSearchSeq = useRef(0);

  // Initial centre: incoming params (current GPS from checkout) ➜ storefront.
  const initialCoords = useMemo(() => {
    const lat = params.lat ? parseFloat(params.lat) : NaN;
    const lng = params.lng ? parseFloat(params.lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return { lat: STORE_LAT, lng: STORE_LNG };
  }, [params.lat, params.lng]);

  const [center, setCenter] = useState(initialCoords);
  const [centerLabel, setCenterLabel] = useState<string | null>(null);
  const [centerLoading, setCenterLoading] = useState(true);
  const [centerAddress, setCenterAddress] =
    useState<DeliveryAddress | null>(null);
  const [moving, setMoving] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DeliveryAddress[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const distanceKm = useMemo(
    () => distanceFromStoreKm(center.lat, center.lng),
    [center.lat, center.lng],
  );

  const shopSettings = useMenuStore((s) => s.shopSettings);
  const baseFee = Number(
    shopSettings?.delivery_base_fee_eur ?? DEFAULT_DELIVERY_BASE_FEE_EUR,
  );
  const perKmRate = Number(
    shopSettings?.delivery_per_km_eur ?? DEFAULT_DELIVERY_PER_KM_EUR,
  );
  const previewFee = computeDeliveryFee(distanceKm, baseFee, perKmRate);

  // Debounced reverse geocode whenever the centre coordinate settles.
  useEffect(() => {
    const seq = ++lastReverseSeq.current;
    setCenterLoading(true);
    const handle = setTimeout(() => {
      void mapboxReverseGeocode(center.lat, center.lng)
        .then((addr) => {
          if (seq !== lastReverseSeq.current) return;
          setCenterAddress(addr);
          setCenterLabel(addr?.label ?? null);
        })
        .catch(() => {
          if (seq !== lastReverseSeq.current) return;
          setCenterAddress(null);
          setCenterLabel(null);
        })
        .finally(() => {
          if (seq !== lastReverseSeq.current) return;
          setCenterLoading(false);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [center.lat, center.lng]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    const seq = ++lastSearchSeq.current;
    setSearchLoading(true);
    const handle = setTimeout(() => {
      void mapboxSearch(q)
        .then((results) => {
          if (seq !== lastSearchSeq.current) return;
          setSuggestions(results);
        })
        .catch(() => {
          if (seq !== lastSearchSeq.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (seq !== lastSearchSeq.current) return;
          setSearchLoading(false);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const flyTo = useCallback((lat: number, lng: number, zoom = 16) => {
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: zoom,
      animationDuration: 400,
    });
  }, []);

  const handleSelectSuggestion = (addr: DeliveryAddress) => {
    void Haptics.selectionAsync();
    setQuery(addr.label);
    setSuggestions([]);
    setSearchOpen(false);
    Keyboard.dismiss();
    flyTo(addr.lat, addr.lng, 16);
    // Optimistic: pretend the centre is now exactly that address so the
    // bottom card updates instantly while the map animates.
    setCenter({ lat: addr.lat, lng: addr.lng });
    setCenterAddress(addr);
    setCenterLabel(addr.label);
    setCenterLoading(false);
  };

  const handleRecenterOnMe = async () => {
    try {
      void Haptics.selectionAsync();
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      flyTo(pos.coords.latitude, pos.coords.longitude, 16);
    } catch {
      // ignore — user can still pan manually
    }
  };

  const handleConfirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalLabel =
      centerAddress?.label ??
      centerLabel ??
      `Lat ${center.lat.toFixed(5)}, Lng ${center.lng.toFixed(5)}`;
    setPicked({
      label: finalLabel,
      lat: center.lat,
      lng: center.lng,
      postcode: centerAddress?.postcode,
      city: centerAddress?.city,
    });
    router.back();
  };

  const onMapIdle = (state: MapState) => {
    setMoving(false);
    const [lng, lat] = state.properties.center as [number, number];
    if (
      Math.abs(lat - center.lat) < 1e-6 &&
      Math.abs(lng - center.lng) < 1e-6
    ) {
      return;
    }
    setCenter({ lat, lng });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <MapView
        style={{ flex: 1 }}
        styleURL={MAPBOX_STYLE_STREETS}
        compassEnabled={false}
        attributionPosition={{ bottom: 120, right: 8 }}
        logoPosition={{ bottom: 120, left: 8 }}
        scaleBarEnabled={false}
        onCameraChanged={() => setMoving(true)}
        onMapIdle={onMapIdle}
      >
        <Camera
          ref={cameraRef as never}
          defaultSettings={{
            centerCoordinate: [initialCoords.lng, initialCoords.lat],
            zoomLevel: 15,
          }}
        />
        <LocationPuck visible pulsing={{ isEnabled: true }} />
      </MapView>

      {/* Fixed centre pin */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            alignItems: "center",
            transform: [{ translateY: moving ? -6 : 0 }],
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.accent,
              borderWidth: 4,
              borderColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.ink,
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <MapPin size={20} color={colors.white} strokeWidth={2.5} />
          </View>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
              marginTop: -3,
              shadowColor: colors.ink,
              shadowOpacity: 0.4,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
            }}
          />
          {/* Ground anchor */}
          <View
            style={{
              width: 18,
              height: 6,
              borderRadius: 3,
              backgroundColor: "rgba(0,0,0,0.18)",
              marginTop: 6,
            }}
          />
        </View>
      </View>

      {/* Top search bar */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: colors.white,
            borderRadius: radius.lg,
            paddingLeft: 6,
            paddingRight: 12,
            height: 52,
            ...shadow.card,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Retour"
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={colors.ink} strokeWidth={2.5} />
          </Pressable>
          <Search size={18} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Rechercher une adresse…"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              fontFamily: font.bodySemi,
              fontSize: 14,
              color: colors.ink,
            }}
          />
          {searchLoading ? (
            <ActivityIndicator size="small" color={colors.inkMuted} />
          ) : query.length > 0 ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                setQuery("");
                setSuggestions([]);
              }}
            >
              <X size={16} color={colors.inkMuted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>

        {searchOpen && suggestions.length > 0 ? (
          <View
            style={{
              marginTop: 8,
              backgroundColor: colors.white,
              borderRadius: radius.lg,
              overflow: "hidden",
              ...shadow.card,
            }}
          >
            {suggestions.map((s, idx) => (
              <Pressable
                key={`${s.lat}-${s.lng}-${idx}`}
                onPress={() => handleSelectSuggestion(s)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: pressed ? "#FAFAF6" : colors.white,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: "#F2F2F2",
                })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MapPin size={15} color={colors.ink} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: font.bodySemi,
                      fontSize: 13,
                      color: colors.ink,
                    }}
                  >
                    {s.label}
                  </Text>
                  {s.postcode && s.city ? (
                    <Text
                      style={{
                        fontFamily: font.body,
                        fontSize: 11,
                        color: colors.inkMuted,
                        marginTop: 1,
                      }}
                    >
                      {s.postcode} · {s.city}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={14} color={colors.inkMuted} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Recenter FAB */}
      <Pressable
        onPress={handleRecenterOnMe}
        accessibilityLabel="Recentrer sur ma position"
        style={({ pressed }) => ({
          position: "absolute",
          right: 16,
          bottom: insets.bottom + 240,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
          ...shadow.card,
        })}
      >
        <Crosshair size={20} color={colors.ink} strokeWidth={2.5} />
      </Pressable>

      {/* Bottom card */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.white,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: Math.max(insets.bottom, 12) + 14,
          ...shadow.float,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPin size={20} color={colors.ink} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 10,
                letterSpacing: 1.5,
                color: colors.inkMuted,
                textTransform: "uppercase",
              }}
            >
              {centerLoading
                ? "Recherche de l'adresse…"
                : `Adresse choisie · ${distanceKm.toFixed(1)} km`}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: font.bodyBold,
                fontSize: 15,
                color: colors.ink,
                marginTop: 4,
              }}
            >
              {centerLoading
                ? "—"
                : centerLabel ??
                  `Point (${center.lat.toFixed(5)}, ${center.lng.toFixed(5)})`}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Pill icon={CornerDownLeft} label="Glisse la carte pour ajuster" />
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 12,
              color: colors.ink,
              letterSpacing: 0.5,
            }}
          >
            +{previewFee.toFixed(2).replace(".", ",")}€
          </Text>
        </View>

        <Pressable
          onPress={handleConfirm}
          disabled={centerLoading}
          accessibilityRole="button"
          accessibilityLabel="Confirmer cette adresse"
          style={({ pressed }) => ({
            backgroundColor: centerLoading ? "#E8E8E8" : colors.primary,
            borderRadius: radius.lg,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: pressed ? 0.92 : 1,
            ...(centerLoading
              ? {}
              : {
                  shadowColor: colors.ink,
                  shadowOpacity: 0.18,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 6,
                }),
          })}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 14,
              letterSpacing: 1,
              color: centerLoading ? colors.inkMuted : colors.ink,
              textTransform: "uppercase",
            }}
          >
            {centerLoading
                ? "Calcul de l'adresse…"
                : "Confirmer cette adresse"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type PillProps = {
  icon: typeof MapPin;
  label: string;
};

function Pill({ icon: Icon, label }: PillProps): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: "#F5F5F5",
        borderRadius: 999,
      }}
    >
      <Icon size={11} color={colors.inkMuted} strokeWidth={2.5} />
      <Text
        style={{
          fontFamily: font.bodySemi,
          fontSize: 10,
          color: colors.inkMuted,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

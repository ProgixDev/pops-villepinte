import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
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
  Check,
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
import { ensureLocationPermission } from "@/lib/location";
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
  // Mirror of the live map centre — updated synchronously from
  // onCameraChanged so handleLockSpot is never reading a stale value
  // (e.g. tapping the pill before onMapIdle's React state update lands).
  const liveCenterRef = useRef({ lat: 0, lng: 0 });

  // Initial centre: incoming params (current GPS from checkout) ➜ storefront.
  const initialCoords = useMemo(() => {
    const lat = params.lat ? parseFloat(params.lat) : NaN;
    const lng = params.lng ? parseFloat(params.lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return { lat: STORE_LAT, lng: STORE_LNG };
  }, [params.lat, params.lng]);

  const [center, setCenter] = useState(initialCoords);
  // Initial sync: liveCenterRef starts equal to initialCoords.
  if (liveCenterRef.current.lat === 0 && liveCenterRef.current.lng === 0) {
    liveCenterRef.current = initialCoords;
  }
  const [centerLabel, setCenterLabel] = useState<string | null>(null);
  const [centerLoading, setCenterLoading] = useState(true);
  const [centerAddress, setCenterAddress] =
    useState<DeliveryAddress | null>(null);
  const [moving, setMoving] = useState(false);

  // Two-step flow: the pin only "locks" when the user taps the floating
  // "Sélectionner cet emplacement" button (or picks a search suggestion).
  // The bottom Confirmer button uses selectedSpot, never the live center.
  const [selectedSpot, setSelectedSpot] = useState<{
    lat: number;
    lng: number;
    address: DeliveryAddress | null;
  } | null>(null);
  const [locking, setLocking] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DeliveryAddress[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Only mount the <LocationPuck> once foreground permission is actually
  // granted — rendering it while the status is undetermined crashes the Mapbox
  // SDK. Mirrors the driver home screen.
  const [locationGranted, setLocationGranted] = useState(false);
  // Gate the whole map mount on the permission prompt being answered. rnmapbox
  // starts its location engine at map load, so the puck must be present in the
  // map's FIRST render — otherwise it won't track until the screen is reopened.
  const [permResolved, setPermResolved] = useState(false);

  // Defer mounting the native <MapView> until the screen-entry transition has
  // settled. Mounting a heavy Fabric native view (the map) on the JS thread
  // *while* the navigation push transition is doing a synchronous main-thread
  // view update deadlocks both threads on the Fabric ComponentDescriptorRegistry
  // lock — a hard crash/freeze on Android (and iOS). This is the exact guard the
  // driver home map uses; runAfterInteractions lets the transition release the
  // UI thread before we commit the map.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setMapReady(true);
    });
    return () => task.cancel();
  }, []);

  // The <Camera> ref attaches on commit, but the native map view isn't
  // registered until Mapbox finishes loading the style. Dispatching an
  // imperative camera command before that sends a viewmanager command to a
  // reactTag the native side doesn't know yet ("Unknown reactTag"). Gate
  // imperative camera calls (flyTo / recenter) on this flag.
  const [mapLoaded, setMapLoaded] = useState(false);

  // Resolve foreground permission up-front, then flip permResolved so the map
  // can mount with the puck correctly present from its first render.
  useEffect(() => {
    let cancelled = false;
    void ensureLocationPermission()
      .then((granted) => {
        if (!cancelled) setLocationGranted(granted);
      })
      .finally(() => {
        if (!cancelled) setPermResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Selection is "fresh" when the on-screen pin coincides with the locked
  // selectedSpot. Tolerance is generous so float drift from Mapbox's idle
  // callback doesn't accidentally flip the button to "stale" after locking.
  const centerMatchesSelection =
    selectedSpot !== null &&
    Math.abs(selectedSpot.lat - center.lat) < 5e-5 &&
    Math.abs(selectedSpot.lng - center.lng) < 5e-5;

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

  const flyTo = useCallback(
    (lat: number, lng: number, zoom = 16) => {
      // Don't dispatch a camera command before the native map is registered.
      if (!mapLoaded) return;
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: zoom,
        animationDuration: 400,
      });
    },
    [mapLoaded],
  );

  const handleSelectSuggestion = (addr: DeliveryAddress) => {
    void Haptics.selectionAsync();
    setQuery(addr.label);
    setSuggestions([]);
    setSearchOpen(false);
    Keyboard.dismiss();
    flyTo(addr.lat, addr.lng, 16);
    // Optimistic: pretend the centre is now exactly that address so the
    // bottom card updates instantly while the map animates. Search picks are
    // explicit, so we also lock them immediately — no extra tap needed.
    liveCenterRef.current = { lat: addr.lat, lng: addr.lng };
    setCenter({ lat: addr.lat, lng: addr.lng });
    setCenterAddress(addr);
    setCenterLabel(addr.label);
    setCenterLoading(false);
    setSelectedSpot({ lat: addr.lat, lng: addr.lng, address: addr });
  };

  // Top floating button — locks the LIVE pin position (from the ref, so it
  // can't ever fall behind the React state update from onMapIdle).
  const handleLockSpot = async () => {
    if (locking) return;
    setLocking(true);
    void Haptics.selectionAsync();
    const liveLat = liveCenterRef.current.lat;
    const liveLng = liveCenterRef.current.lng;

    // Reverse-geocode the live position; if a previous geocode for these
    // exact coords already cached an address we reuse it, otherwise we hit
    // Mapbox now and await it.
    let resolved: DeliveryAddress | null = null;
    if (
      centerAddress &&
      Math.abs(centerAddress.lat - liveLat) < 1e-5 &&
      Math.abs(centerAddress.lng - liveLng) < 1e-5
    ) {
      resolved = centerAddress;
    } else {
      try {
        resolved = await mapboxReverseGeocode(liveLat, liveLng);
      } catch {
        resolved = null;
      }
    }

    setSelectedSpot({
      lat: liveLat,
      lng: liveLng,
      address: resolved,
    });
    // Pin state and selection MUST line up exactly, otherwise tiny float
    // drift from later onCameraChanged callbacks keeps `centerMatchesSelection`
    // false and the Confirmer stays gray after locking.
    setCenter({ lat: liveLat, lng: liveLng });
    if (resolved) {
      setCenterAddress(resolved);
      setCenterLabel(resolved.label);
    }
    setLocking(false);
  };

  const handleRecenterOnMe = async () => {
    try {
      void Haptics.selectionAsync();
      const granted = await ensureLocationPermission();
      setLocationGranted(granted);
      if (!granted) return;
      // First fix right after the grant can throw on a cold GPS provider —
      // fall back to the last-known fix so the user doesn't need to restart.
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        pos = await Location.getLastKnownPositionAsync();
      }
      if (!pos) pos = await Location.getLastKnownPositionAsync();
      if (pos) flyTo(pos.coords.latitude, pos.coords.longitude, 16);
    } catch {
      // ignore — user can still pan manually
    }
  };

  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (confirming || !selectedSpot) return;
    setConfirming(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Resolve the label if it wasn't captured at lock time (e.g. offline).
    let resolved = selectedSpot.address;
    if (!resolved) {
      try {
        resolved = await mapboxReverseGeocode(
          selectedSpot.lat,
          selectedSpot.lng,
        );
      } catch {
        resolved = null;
      }
    }

    const finalLabel =
      resolved?.label ??
      `Lat ${selectedSpot.lat.toFixed(5)}, Lng ${selectedSpot.lng.toFixed(5)}`;
    setPicked({
      label: finalLabel,
      lat: selectedSpot.lat,
      lng: selectedSpot.lng,
      postcode: resolved?.postcode,
      city: resolved?.city,
    });
    setConfirming(false);
    router.back();
  };

  // Values shown in the bottom card — always reflect the LOCKED selection,
  // not the live pin position.
  const cardDistanceKm = selectedSpot
    ? distanceFromStoreKm(selectedSpot.lat, selectedSpot.lng)
    : distanceKm;
  const cardFee = computeDeliveryFee(cardDistanceKm, baseFee, perKmRate);
  const cardLabel = selectedSpot
    ? (selectedSpot.address?.label ??
        `Lat ${selectedSpot.lat.toFixed(5)}, Lng ${selectedSpot.lng.toFixed(5)}`)
    : null;

  // Keep the live ref in lockstep with the camera. onCameraChanged fires on
  // every frame of pan/zoom/animation — cheap, no React state churn.
  const onCameraChanged = (state: MapState) => {
    const [lng, lat] = state.properties.center as [number, number];
    liveCenterRef.current = { lat, lng };
    if (!moving) setMoving(true);
  };

  const onMapIdle = (state: MapState) => {
    setMoving(false);
    const [lng, lat] = state.properties.center as [number, number];
    liveCenterRef.current = { lat, lng };
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
      {mapReady && permResolved ? (
        <MapView
          style={{ flex: 1 }}
          styleURL={MAPBOX_STYLE_STREETS}
          compassEnabled={false}
          attributionPosition={{ bottom: 120, right: 8 }}
          logoPosition={{ bottom: 120, left: 8 }}
          scaleBarEnabled={false}
          onDidFinishLoadingMap={() => setMapLoaded(true)}
          onCameraChanged={onCameraChanged}
          onMapIdle={onMapIdle}
        >
          <Camera
            ref={cameraRef as never}
            defaultSettings={{
              centerCoordinate: [initialCoords.lng, initialCoords.lat],
              zoomLevel: 15,
            }}
          />
          {locationGranted ? (
            <LocationPuck visible pulsing={{ isEnabled: true }} />
          ) : null}
        </MapView>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.ink,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

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
              backgroundColor:
                selectedSpot && centerMatchesSelection
                  ? colors.primary
                  : "#F0F0F0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPin
              size={20}
              color={
                selectedSpot && centerMatchesSelection
                  ? colors.ink
                  : colors.inkMuted
              }
              strokeWidth={2.5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 10,
                letterSpacing: 1.5,
                color:
                  selectedSpot && !centerMatchesSelection
                    ? colors.accent
                    : colors.inkMuted,
                textTransform: "uppercase",
              }}
            >
              {!selectedSpot
                ? "Aucune adresse sélectionnée"
                : !centerMatchesSelection
                  ? "Tu as bougé · sélectionne pour mettre à jour"
                  : `Adresse choisie · ${cardDistanceKm.toFixed(1)} km`}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: font.bodyBold,
                fontSize: 15,
                color: selectedSpot ? colors.ink : colors.inkMuted,
                marginTop: 4,
              }}
            >
              {selectedSpot
                ? cardLabel ?? "—"
                : "Glisse la carte, puis sélectionne ta position."}
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
          <Pill
            icon={CornerDownLeft}
            label={
              selectedSpot
                ? "Tu peux ajuster en bougeant la carte"
                : "Glisse la carte pour pointer un lieu"
            }
          />
          {selectedSpot ? (
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 12,
                color: colors.ink,
                letterSpacing: 0.5,
              }}
            >
              +{cardFee.toFixed(2).replace(".", ",")}€
            </Text>
          ) : null}
        </View>

        {/* Step 1 — lock the current pin. Stays visible whenever the pin
            doesn't match the locked spot (covers "no selection yet" and
            "user has moved the map" cases alike). */}
        {!centerMatchesSelection ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sélectionner cette position"
            onPress={() => void handleLockSpot()}
            disabled={locking}
            style={({ pressed }) => ({
              backgroundColor: colors.ink,
              borderRadius: radius.lg,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 10,
              opacity: pressed || locking ? 0.92 : 1,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {locking ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Check size={13} color={colors.ink} strokeWidth={3} />
              )}
            </View>
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 13,
                letterSpacing: 1.5,
                color: colors.primary,
                textTransform: "uppercase",
              }}
            >
              {locking
                ? "Sélection…"
                : selectedSpot
                  ? "Sélectionner cette position"
                  : "Sélectionner cette position"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => void handleConfirm()}
          disabled={
            confirming || !selectedSpot || !centerMatchesSelection
          }
          accessibilityRole="button"
          accessibilityLabel="Confirmer cette adresse"
          style={({ pressed }) => {
            const inactive =
              confirming || !selectedSpot || !centerMatchesSelection;
            return {
              backgroundColor: inactive ? "#E8E8E8" : colors.primary,
              borderRadius: radius.lg,
              paddingVertical: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: pressed ? 0.92 : 1,
              ...(inactive
                ? {}
                : {
                    shadowColor: colors.ink,
                    shadowOpacity: 0.18,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 6,
                  }),
            };
          }}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 14,
              letterSpacing: 1,
              color:
                confirming || !selectedSpot || !centerMatchesSelection
                  ? colors.inkMuted
                  : colors.ink,
              textTransform: "uppercase",
            }}
          >
            {confirming
              ? "Enregistrement…"
              : !selectedSpot
                ? "Sélectionne d'abord ta position"
                : !centerMatchesSelection
                  ? "Sélectionne la nouvelle position"
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

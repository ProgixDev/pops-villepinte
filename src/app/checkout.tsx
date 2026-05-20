import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bike,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Route,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  User,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OrderConfirmation from "@/components/order/OrderConfirmation";
import StaticMap from "@/components/checkout/StaticMap";
import { isGuestName } from "@/constants/profile";
import { ROUTES } from "@/constants/routes";
import { colors, font, radius } from "@/constants/theme";
import {
  DELIVERY_FEE_EUR,
  DELIVERY_MAX_KM,
  STORE_ADDRESS,
  STORE_LAT,
  STORE_LNG,
  distanceFromStoreKm,
  searchFrenchAddresses,
  type DeliveryAddress,
} from "@/lib/delivery";
import { formatPriceEUR } from "@/lib/format";
import { formatFrenchMobile } from "@/lib/phone";
import { getLineUnitPrice, useCartStore } from "@/store/cart.store";
import { useMenuStore } from "@/store/menu.store";
import { useOrdersStore } from "@/store/orders.store";
import { useProfileStore } from "@/store/profile.store";

type Mode = "pickup" | "delivery";

export default function CheckoutScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.totalEUR());
  const clearCart = useCartStore((s) => s.clearCart);
  const placeOrder = useOrdersStore((s) => s.placeOrder);
  const orderLoading = useOrdersStore((s) => s.loading);
  const profile = useProfileStore((s) => s.profile);
  const getProductById = useMenuStore((s) => s.getProductById);
  const getSupplementById = useMenuStore((s) => s.getSupplementById);
  const accompagnements = useMenuStore((s) => s.accompagnements);

  const registeredName = isGuestName(profile.name) ? "" : profile.name;
  const formattedPhone = profile.phone ? formatFrenchMobile(profile.phone) : "";

  const [mode, setMode] = useState<Mode>("pickup");
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] =
    useState<DeliveryAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchSeq = useRef(0);

  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Debounced BAN search whenever the typed query changes.
  useEffect(() => {
    if (mode !== "delivery") return;
    const q = addressQuery.trim();
    if (q.length < 3 || selectedAddress?.label === q) {
      setSuggestions([]);
      setAddressLoading(false);
      return;
    }
    const mySeq = ++searchSeq.current;
    setAddressLoading(true);
    const handle = setTimeout(() => {
      void searchFrenchAddresses(q)
        .then((results) => {
          // Drop stale responses if a newer query already fired.
          if (mySeq !== searchSeq.current) return;
          setSuggestions(results);
        })
        .catch(() => {
          if (mySeq !== searchSeq.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (mySeq !== searchSeq.current) return;
          setAddressLoading(false);
        });
    }, 280);
    return () => clearTimeout(handle);
  }, [addressQuery, mode, selectedAddress?.label]);

  const distanceKm = useMemo(() => {
    if (mode !== "delivery" || !selectedAddress) return null;
    return distanceFromStoreKm(selectedAddress.lat, selectedAddress.lng);
  }, [mode, selectedAddress]);

  const isOutOfZone =
    distanceKm !== null && distanceKm > DELIVERY_MAX_KM;
  const deliveryFee = mode === "delivery" && !isOutOfZone ? DELIVERY_FEE_EUR : 0;
  const grandTotal = total + deliveryFee;

  const handlePickMode = (next: Mode): void => {
    if (next === mode) return;
    void Haptics.selectionAsync();
    setMode(next);
    setConfirmError(undefined);
    setSubmitError(undefined);
  };

  const handleSelectAddress = (addr: DeliveryAddress): void => {
    void Haptics.selectionAsync();
    setSelectedAddress(addr);
    setAddressQuery(addr.label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleClearAddress = (): void => {
    setSelectedAddress(null);
    setAddressQuery("");
    setSuggestions([]);
  };

  useEffect(() => {
    if (items.length === 0 && !showConfirmation) {
      router.replace(ROUTES.home);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const estimatedMinutes = useMemo(() => {
    if (items.length === 0) return 0;
    const maxPrep = Math.max(
      ...items.map((i) => {
        const p = i.productId ? getProductById(i.productId) : undefined;
        return p?.prep_time_minutes ?? 0;
      }),
    );
    return maxPrep + 2;
  }, [items, getProductById]);

  const itemCount = useMemo(
    () => items.reduce((a, i) => a + i.quantity, 0),
    [items],
  );

  const deliveryReady =
    mode === "pickup" || (selectedAddress !== null && !isOutOfZone);
  const canConfirm =
    registeredName.length >= 2 && confirmed && deliveryReady;

  const handleConfirm = async (): Promise<void> => {
    if (registeredName.length < 2) {
      setSubmitError(
        "Ton profil n'a pas encore de prénom — termine ton inscription.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (mode === "delivery") {
      if (!selectedAddress) {
        setSubmitError("Choisis une adresse de livraison dans les suggestions.");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      if (isOutOfZone) {
        setSubmitError(
          `Adresse hors zone (~${distanceKm?.toFixed(1)} km). Max ${DELIVERY_MAX_KM} km.`,
        );
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }
    if (!confirmed) {
      setConfirmError(
        mode === "delivery"
          ? "Coche la case pour confirmer ta livraison."
          : "Coche la case pour confirmer ton retrait.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setConfirmError(undefined);

    try {
      setSubmitError(undefined);
      const delivery =
        mode === "delivery" && selectedAddress
          ? ({
              pickupMode: "delivery" as const,
              address: selectedAddress.label,
              lat: selectedAddress.lat,
              lng: selectedAddress.lng,
            } as const)
          : ({ pickupMode: "pickup" as const } as const);
      const newOrder = await placeOrder(items, registeredName, delivery);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      setPendingOrderId(newOrder.id);
      setShowConfirmation(true);
    } catch (e: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        e instanceof Error ? e.message : "Erreur lors de la commande";
      setSubmitError(message);
    }
  };

  const handleConfirmationDone = (): void => {
    setShowConfirmation(false);
    if (pendingOrderId !== null) {
      router.replace(ROUTES.orderDetail(pendingOrderId));
    }
  };

  if (items.length === 0 && !showConfirmation) {
    return <View style={{ flex: 1, backgroundColor: colors.white }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 140,
        }}
      >
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            marginBottom: 16,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#F5F5F5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={colors.ink} strokeWidth={2.5} />
          </Pressable>
          <Text
            style={{
              fontFamily: font.bodySemi,
              fontSize: 13,
              color: colors.inkMuted,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Confirmation
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Header */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 42,
              lineHeight: 44,
              color: colors.ink,
              letterSpacing: 1,
            }}
          >
            QUI COMMANDE ?
          </Text>
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 14,
              color: colors.inkMuted,
              marginTop: 4,
            }}
          >
            Dernière étape avant de te régaler
          </Text>
        </View>

        {/* Identity (read-only — pulled from registered profile) */}
        <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 10 }}>
          <ProfileRow
            icon={User}
            label="Prénom"
            value={registeredName || "—"}
          />
          <ProfileRow
            icon={Phone}
            label="Téléphone"
            value={formattedPhone || "—"}
          />
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 11,
              color: colors.inkMuted,
              marginTop: 2,
              paddingHorizontal: 4,
            }}
          >
            Tu commandes avec le compte avec lequel tu t'es inscrit·e.
          </Text>
        </View>

        {/* Separator */}
        <View style={{ height: 8, backgroundColor: "#F5F5F5", marginTop: 24 }} />

        {/* Mode selector — pickup vs delivery */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 11,
              letterSpacing: 2,
              color: colors.inkMuted,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Comment tu reçois ta commande ?
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
            }}
          >
            <ModeCard
              active={mode === "pickup"}
              icon={StoreIcon}
              title="Sur place"
              subtitle="Je viens chercher"
              meta={`~${estimatedMinutes} min`}
              onPress={() => handlePickMode("pickup")}
            />
            <ModeCard
              active={mode === "delivery"}
              icon={Bike}
              title="Livraison"
              subtitle="On t'apporte"
              meta={`+${DELIVERY_FEE_EUR}€`}
              onPress={() => handlePickMode("delivery")}
            />
          </View>
        </View>

        {mode === "pickup" ? (
          <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
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
                <MapPin size={22} color={colors.ink} strokeWidth={2} />
              </View>
              <View>
                <Text style={{ fontFamily: font.bodyBold, fontSize: 15, color: colors.ink }}>
                  POP'S Villepinte
                </Text>
                <Text style={{ fontFamily: font.body, fontSize: 12, color: colors.inkMuted, marginTop: 1 }}>
                  {STORE_ADDRESS}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <InfoTile
                icon={Clock}
                value={String(estimatedMinutes)}
                label="MINUTES"
              />
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F5F5F5",
                  borderRadius: radius.lg,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: font.bodySemi, fontSize: 12, color: colors.inkMuted }}>
                  Paiement
                </Text>
                <Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: colors.ink, marginTop: 6 }}>
                  Sur place
                </Text>
                <Text style={{ fontFamily: font.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 }}>
                  Cash ou CB
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <DeliveryPanel
            addressQuery={addressQuery}
            setAddressQuery={(v) => {
              setAddressQuery(v);
              if (selectedAddress && selectedAddress.label !== v) {
                setSelectedAddress(null);
              }
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onClear={handleClearAddress}
            suggestions={suggestions}
            loading={addressLoading}
            showSuggestions={showSuggestions}
            selected={selectedAddress}
            distanceKm={distanceKm}
            isOutOfZone={isOutOfZone}
            estimatedMinutes={estimatedMinutes + 10}
            onPick={handleSelectAddress}
          />
        )}

        {/* Separator */}
        <View style={{ height: 8, backgroundColor: "#F5F5F5" }} />

        {/* Commitment */}
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setConfirmed(!confirmed);
            setConfirmError(undefined);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 18,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: confirmed ? colors.primary : "#F5F5F5",
              borderWidth: confirmed ? 0 : 2,
              borderColor: "#E0E0E0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {confirmed ? <Check size={16} color={colors.ink} strokeWidth={3} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: 14, color: colors.ink }}>
              {mode === "pickup"
                ? "Je viens chercher ma commande"
                : "Je serai dispo à mon adresse"}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>
              {mode === "pickup"
                ? "Ta parole compte — pas de no-show."
                : "Le livreur t'appelle en arrivant."}
            </Text>
          </View>
          <ShieldCheck size={20} color={confirmed ? colors.primary : colors.inkMuted} strokeWidth={2} />
        </Pressable>

        {confirmError !== undefined ? (
          <Text
            style={{
              fontFamily: font.bodySemi,
              fontSize: 11,
              color: colors.error,
              paddingHorizontal: 20,
              marginTop: -8,
              marginBottom: 12,
            }}
          >
            {confirmError}
          </Text>
        ) : null}

        {/* Separator */}
        <View style={{ height: 8, backgroundColor: "#F5F5F5" }} />

        {/* Order recap */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 11,
              letterSpacing: 2,
              color: colors.inkMuted,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Récapitulatif · {itemCount} article{itemCount > 1 ? "s" : ""}
          </Text>

          {items.map((item) => {
            const product = item.productId
              ? getProductById(item.productId)
              : undefined;
            const accompagnement = item.accompagnementId
              ? accompagnements.find((a) => a.id === item.accompagnementId)
              : undefined;
            const displayName = product?.name ?? accompagnement?.name;
            if (!displayName) return null;
            const variant = item.variantId
              ? product?.product_variants?.find((v) => v.id === item.variantId)
              : undefined;
            const unitPrice = getLineUnitPrice(item);
            const lineTotal = unitPrice * item.quantity;
            const supNames = item.supplements
              .map((sid) => getSupplementById(sid)?.name)
              .filter(Boolean)
              .join(", ");

            return (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F5F5F5",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: 14, color: colors.ink }}>
                    {item.quantity}× {displayName}
                    {variant ? ` · ${variant.label}` : ""}
                  </Text>
                  {supNames ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: font.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 }}
                    >
                      {supNames}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.ink }}>
                  {formatPriceEUR(lineTotal)}
                </Text>
              </View>
            );
          })}

          {deliveryFee > 0 ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 10,
                marginTop: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Bike size={14} color={colors.inkMuted} strokeWidth={2} />
                <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: colors.ink }}>
                  Frais de livraison
                </Text>
              </View>
              <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: colors.ink }}>
                {formatPriceEUR(deliveryFee)}
              </Text>
            </View>
          ) : null}

          {/* Total */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 16,
              paddingTop: 14,
              borderTopWidth: 2,
              borderTopColor: colors.ink,
            }}
          >
            <Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: colors.ink }}>
              Total
            </Text>
            <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>
              {formatPriceEUR(grandTotal)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* STICKY CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.white,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
        }}
      >
        {submitError !== undefined ? (
          <Text
            style={{
              fontFamily: font.bodySemi,
              fontSize: 12,
              color: colors.error,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            {submitError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void handleConfirm()}
          disabled={orderLoading}
          style={{
            backgroundColor: canConfirm ? colors.primary : "#E8E8E8",
            borderRadius: radius.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingVertical: 16,
            ...(canConfirm
              ? {
                  shadowColor: colors.ink,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 8,
                }
              : {}),
          }}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 15,
              color: canConfirm ? colors.ink : colors.inkMuted,
              letterSpacing: 0.5,
            }}
          >
            {canConfirm ? "CONFIRMER LA COMMANDE" : "COMPLÉTEZ LES CHAMPS"}
          </Text>
          <View
            style={{
              backgroundColor: canConfirm ? colors.ink : "#D0D0D0",
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 20,
                color: canConfirm ? colors.primary : colors.inkMuted,
              }}
            >
              {formatPriceEUR(grandTotal)}
            </Text>
          </View>
        </Pressable>
      </View>

      <OrderConfirmation
        visible={showConfirmation}
        onDone={handleConfirmationDone}
      />
    </KeyboardAvoidingView>
  );
}

type ProfileRowProps = {
  icon: typeof User;
  label: string;
  value: string;
};

function ProfileRow({
  icon: Icon,
  label,
  value,
}: ProfileRowProps): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: "#F7F7F4",
        borderRadius: radius.lg,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 10,
            letterSpacing: 1.5,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: font.bodyBold,
            fontSize: 15,
            color: colors.ink,
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

type ModeCardProps = {
  active: boolean;
  icon: typeof StoreIcon;
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
};

function ModeCard({
  active,
  icon: Icon,
  title,
  subtitle,
  meta,
  onPress,
}: ModeCardProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        backgroundColor: active ? colors.ink : "#F7F7F4",
        borderRadius: radius.lg,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 8,
        borderWidth: 2,
        borderColor: active ? colors.primary : "transparent",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: active ? colors.primary : colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text
          style={{
            fontFamily: font.bodyBold,
            fontSize: 14,
            color: active ? colors.white : colors.ink,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: font.bodyBold,
            fontSize: 11,
            letterSpacing: 0.5,
            color: active ? colors.primary : colors.inkMuted,
          }}
        >
          {meta}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: font.body,
          fontSize: 11,
          color: active ? "rgba(255,255,255,0.7)" : colors.inkMuted,
        }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

type InfoTileProps = {
  icon: typeof Clock;
  value: string;
  label: string;
};

function InfoTile({ icon: Icon, value, label }: InfoTileProps): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
        borderRadius: radius.lg,
        padding: 16,
        alignItems: "center",
      }}
    >
      <Icon size={20} color={colors.ink} strokeWidth={2} />
      <Text style={{ fontFamily: font.display, fontSize: 36, color: colors.ink, marginTop: 4 }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: font.bodySemi,
          fontSize: 11,
          color: colors.inkMuted,
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

type DeliveryPanelProps = {
  addressQuery: string;
  setAddressQuery: (v: string) => void;
  onFocus: () => void;
  onClear: () => void;
  suggestions: DeliveryAddress[];
  loading: boolean;
  showSuggestions: boolean;
  selected: DeliveryAddress | null;
  distanceKm: number | null;
  isOutOfZone: boolean;
  estimatedMinutes: number;
  onPick: (a: DeliveryAddress) => void;
};

function DeliveryPanel({
  addressQuery,
  setAddressQuery,
  onFocus,
  onClear,
  suggestions,
  loading,
  showSuggestions,
  selected,
  distanceKm,
  isOutOfZone,
  estimatedMinutes,
  onPick,
}: DeliveryPanelProps): React.ReactElement {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
      {/* Search input */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#F5F5F5",
          borderRadius: radius.lg,
          paddingHorizontal: 14,
          height: 52,
          gap: 10,
          borderWidth: selected ? 2 : 0,
          borderColor: selected ? colors.primary : "transparent",
        }}
      >
        <Search size={18} color={colors.inkMuted} strokeWidth={2} />
        <TextInput
          value={addressQuery}
          onChangeText={setAddressQuery}
          onFocus={onFocus}
          placeholder="Numéro et rue, ville…"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            fontFamily: font.bodySemi,
            fontSize: 14,
            color: colors.ink,
            paddingVertical: 12,
          }}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.inkMuted} />
        ) : addressQuery.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={10}>
            <X size={16} color={colors.inkMuted} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && !selected ? (
        <View
          style={{
            backgroundColor: colors.white,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: "#EFEFEF",
            overflow: "hidden",
          }}
        >
          {suggestions.map((s, idx) => (
            <Pressable
              key={`${s.lat}-${s.lng}-${idx}`}
              onPress={() => onPick(s)}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
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
                  style={{ fontFamily: font.bodySemi, fontSize: 13, color: colors.ink }}
                >
                  {s.label}
                </Text>
                {s.postcode && s.city ? (
                  <Text
                    style={{ fontFamily: font.body, fontSize: 11, color: colors.inkMuted, marginTop: 1 }}
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

      {/* Selected address + map + stats */}
      {selected ? (
        <View style={{ gap: 12 }}>
          <StaticMap
            lat={selected.lat}
            lng={selected.lng}
            secondaryLat={STORE_LAT}
            secondaryLng={STORE_LNG}
            height={200}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: isOutOfZone ? "#FFF1F0" : "#FFFBEB",
              borderRadius: radius.lg,
              padding: 14,
              borderWidth: 1,
              borderColor: isOutOfZone ? "#FBD3CF" : "#F5E7A4",
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isOutOfZone ? colors.accent : colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPin size={16} color={isOutOfZone ? colors.white : colors.ink} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={{ fontFamily: font.bodyBold, fontSize: 13, color: colors.ink }}
              >
                {selected.label}
              </Text>
              {isOutOfZone ? (
                <Text
                  style={{
                    fontFamily: font.bodySemi,
                    fontSize: 11,
                    color: colors.accent,
                    marginTop: 2,
                  }}
                >
                  Hors zone · max {DELIVERY_MAX_KM} km
                </Text>
              ) : (
                <Text
                  style={{
                    fontFamily: font.body,
                    fontSize: 11,
                    color: colors.inkMuted,
                    marginTop: 2,
                  }}
                >
                  {selected.postcode && selected.city
                    ? `${selected.postcode} · ${selected.city}`
                    : "Adresse confirmée"}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClear}
              hitSlop={10}
              accessibilityLabel="Changer l'adresse"
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          {!isOutOfZone ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <DeliveryStat
                icon={Route}
                value={`${distanceKm?.toFixed(1) ?? "—"}`}
                unit="KM"
              />
              <DeliveryStat
                icon={Clock}
                value={`${estimatedMinutes}`}
                unit="MIN"
              />
              <DeliveryStat
                icon={Bike}
                value={`${DELIVERY_FEE_EUR}€`}
                unit="LIVRAISON"
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: "#F7F7F4",
            borderRadius: radius.lg,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bike size={18} color={colors.ink} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodyBold, fontSize: 13, color: colors.ink }}>
              Livraison Villepinte & alentours
            </Text>
            <Text
              style={{
                fontFamily: font.body,
                fontSize: 11,
                color: colors.inkMuted,
                marginTop: 2,
              }}
            >
              {DELIVERY_FEE_EUR}€ jusqu'à {DELIVERY_MAX_KM} km · Cash à la livraison
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

type DeliveryStatProps = {
  icon: typeof Route;
  value: string;
  unit: string;
};

function DeliveryStat({
  icon: Icon,
  value,
  unit,
}: DeliveryStatProps): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
        borderRadius: radius.lg,
        padding: 12,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Icon size={16} color={colors.ink} strokeWidth={2} />
      <Text
        style={{
          fontFamily: font.display,
          fontSize: 22,
          color: colors.ink,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: font.bodySemi,
          fontSize: 9,
          letterSpacing: 1,
          color: colors.inkMuted,
        }}
      >
        {unit}
      </Text>
    </View>
  );
}

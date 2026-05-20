import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  Bike,
  Clock,
  Hash,
  MapPin,
  Phone,
  RefreshCw,
  Store as StoreIcon,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, font, radius, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { formatFrenchMobile } from "@/lib/phone";
import { useMenuStore } from "@/store/menu.store";
import type { Order } from "@/types";

const STATUS_LABELS: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  received: { label: "Reçue", bg: "#F5F5F5", fg: colors.inkMuted },
  preparing: { label: "En préparation", bg: "#FFF8E1", fg: "#F57F17" },
  ready: { label: "Prête", bg: "#E8F5E9", fg: "#2E7D32" },
  handed_to_livreur: {
    label: "Avec le livreur",
    bg: "#FFF4D6",
    fg: "#A66C00",
  },
  picked_up: { label: "Récupérée", bg: "#E8F5E9", fg: "#2E7D32" },
  cancelled: { label: "Annulée", bg: "#FFEBEE", fg: "#C62828" },
};

function formatFullDate(iso: string): string {
  const raw = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export type OrderDetailsSheetProps = {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onReorder?: (order: Order) => void;
  customerPhone?: string | null;
};

export default function OrderDetailsSheet({
  order,
  visible,
  onClose,
  onReorder,
  customerPhone,
}: OrderDetailsSheetProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const getProductById = useMenuStore((s) => s.getProductById);
  const getSupplementById = useMenuStore((s) => s.getSupplementById);
  const accompagnements = useMenuStore((s) => s.accompagnements);

  const lines = useMemo(() => {
    if (!order) return [] as Array<{
      key: string;
      qty: number;
      name: string;
      variantLabel?: string;
      supplementNames: string[];
      notes?: string;
      lineTotal: number;
    }>;
    return order.items.map((item) => {
      const product = item.productId ? getProductById(item.productId) : undefined;
      const accompagnement = item.accompagnementId
        ? accompagnements.find((a) => a.id === item.accompagnementId)
        : undefined;
      const name = product?.name ?? accompagnement?.name ?? "Article";
      const variant =
        item.variantId !== undefined
          ? product?.product_variants?.find((v) => v.id === item.variantId)
          : undefined;
      const supplementNames = item.supplements
        .map((sid) => getSupplementById(sid)?.name)
        .filter((n): n is string => !!n);

      // Unit price prefers variant > product > accompagnement; supplements added.
      const baseUnit =
        variant?.price_eur ??
        product?.price_eur ??
        accompagnement?.price_eur ??
        0;
      const supTotal = item.supplements.reduce((acc, sid) => {
        const s = getSupplementById(sid);
        return acc + (s?.price_eur ?? 0);
      }, 0);
      const lineTotal = (Number(baseUnit) + supTotal) * item.quantity;

      return {
        key: item.id,
        qty: item.quantity,
        name,
        variantLabel: variant?.label,
        supplementNames,
        notes: item.notes,
        lineTotal,
      };
    });
  }, [order, getProductById, getSupplementById, accompagnements]);

  if (!order) return null;

  const status = STATUS_LABELS[order.status] ?? STATUS_LABELS.received!;
  const isDelivery = order.pickupMode === "delivery";
  const deliveryFee = Number(order.deliveryFeeEUR ?? 0);
  const itemsSubtotal = Math.max(
    0,
    Number(order.totalEUR) - deliveryFee,
  );

  const handleReorder = () => {
    if (!onReorder) return;
    void Haptics.selectionAsync();
    onReorder(order);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        // Transparent backdrop — keeps tap-outside-to-close behaviour without
        // dimming the area above the sheet.
        style={{
          flex: 1,
          backgroundColor: "transparent",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: "92%",
            ...shadow.float,
          }}
        >
          {/* Grabber */}
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#E0E0E0",
              marginTop: 10,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <Hash size={12} color={colors.inkMuted} strokeWidth={2.5} />
                <Text
                  style={{
                    fontFamily: font.bodySemi,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: colors.inkMuted,
                    textTransform: "uppercase",
                  }}
                >
                  Commande
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 26,
                  lineHeight: 28,
                  color: colors.ink,
                  letterSpacing: 0.5,
                }}
              >
                {order.id}
              </Text>
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 12,
                  color: colors.inkMuted,
                  marginTop: 4,
                }}
              >
                {formatFullDate(order.createdAt)}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <View
                style={{
                  backgroundColor: status.bg,
                  borderRadius: radius.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 10,
                    letterSpacing: 1,
                    color: status.fg,
                    textTransform: "uppercase",
                  }}
                >
                  {status.label}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Fermer"
                hitSlop={10}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#F5F5F5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} color={colors.ink} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Mode + address */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: "#F7F7F4",
                borderRadius: radius.lg,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 12,
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
                {isDelivery ? (
                  <Bike size={16} color={colors.ink} strokeWidth={2} />
                ) : (
                  <StoreIcon size={16} color={colors.ink} strokeWidth={2} />
                )}
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
                  {isDelivery ? "Livraison" : "Retrait sur place"}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: font.bodySemi,
                    fontSize: 13,
                    color: colors.ink,
                    marginTop: 2,
                  }}
                >
                  {isDelivery
                    ? order.deliveryAddress ?? "Adresse indisponible"
                    : "Avenue Gabriel Péri, 93420 Villepinte"}
                </Text>
              </View>
            </View>

            {/* Quick stats */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <StatTile
                icon={Clock}
                value={
                  order.pickedUpAt
                    ? formatTime(order.pickedUpAt)
                    : formatTime(order.estimatedReadyAt)
                }
                label={order.pickedUpAt ? "REMISE À" : "PRÊTE VERS"}
              />
              {customerPhone ? (
                <StatTile
                  icon={Phone}
                  value={formatFrenchMobile(customerPhone)}
                  label="CONTACT"
                />
              ) : null}
              {isDelivery && order.deliveryLat !== undefined ? (
                <StatTile
                  icon={MapPin}
                  value={`${order.deliveryLat.toFixed(3)}, ${(order.deliveryLng ?? 0).toFixed(3)}`}
                  label="POSITION"
                />
              ) : null}
            </View>

            {/* Items */}
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 10,
                letterSpacing: 1.5,
                color: colors.inkMuted,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Articles · {order.items.reduce((a, i) => a + i.quantity, 0)}
            </Text>
            <View
              style={{
                backgroundColor: "#FAFAFA",
                borderRadius: radius.lg,
                paddingHorizontal: 14,
                paddingVertical: 4,
                marginBottom: 14,
              }}
            >
              {lines.map((ln, idx) => (
                <View
                  key={ln.key}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: "#F0F0F0",
                  }}
                >
                  <View
                    style={{
                      minWidth: 34,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.ink,
                      paddingHorizontal: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      alignSelf: "flex-start",
                      marginTop: 1,
                      marginRight: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: font.bodyBold,
                        fontSize: 12,
                        color: colors.primary,
                      }}
                    >
                      {ln.qty}×
                    </Text>
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      style={{
                        fontFamily: font.bodyBold,
                        fontSize: 14,
                        color: colors.ink,
                      }}
                    >
                      {ln.name}
                      {ln.variantLabel ? (
                        <Text style={{ color: colors.inkMuted }}>
                          {" · "}
                          {ln.variantLabel}
                        </Text>
                      ) : null}
                    </Text>
                    {ln.supplementNames.length > 0 ? (
                      <Text
                        style={{
                          fontFamily: font.body,
                          fontSize: 11,
                          color: colors.inkMuted,
                          marginTop: 2,
                        }}
                      >
                        + {ln.supplementNames.join(" · ")}
                      </Text>
                    ) : null}
                    {ln.notes ? (
                      <Text
                        style={{
                          fontFamily: font.body,
                          fontSize: 11,
                          color: colors.inkMuted,
                          marginTop: 2,
                          fontStyle: "italic",
                        }}
                      >
                        Note : {ln.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontFamily: font.bodyBold,
                      fontSize: 14,
                      color: colors.ink,
                    }}
                  >
                    {formatPriceEUR(ln.lineTotal)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={{ marginBottom: 12 }}>
              <TotalRow label="Sous-total" value={formatPriceEUR(itemsSubtotal)} />
              {deliveryFee > 0 ? (
                <TotalRow
                  icon={Bike}
                  label="Frais de livraison"
                  value={formatPriceEUR(deliveryFee)}
                />
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 2,
                  borderTopColor: colors.ink,
                }}
              >
                <Text
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 13,
                    color: colors.ink,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Total
                </Text>
                <Text
                  style={{
                    fontFamily: font.display,
                    fontSize: 28,
                    color: colors.ink,
                    letterSpacing: -0.5,
                  }}
                >
                  {formatPriceEUR(order.totalEUR)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer actions */}
          {onReorder ? (
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: Math.max(insets.bottom, 12) + 14,
                borderTopWidth: 1,
                borderTopColor: "#F2F2F2",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Recommander la commande ${order.id}`}
                onPress={handleReorder}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: radius.lg,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: pressed ? 0.92 : 1,
                  shadowColor: colors.ink,
                  shadowOpacity: 0.18,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 6,
                })}
              >
                <RefreshCw size={16} color={colors.ink} strokeWidth={2.5} />
                <Text
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 14,
                    letterSpacing: 1,
                    color: colors.ink,
                    textTransform: "uppercase",
                  }}
                >
                  Recommander
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type StatTileProps = {
  icon: typeof Clock;
  value: string;
  label: string;
};

function StatTile({ icon: Icon, value, label }: StatTileProps): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
        borderRadius: radius.lg,
        paddingVertical: 12,
        paddingHorizontal: 12,
        alignItems: "center",
        gap: 4,
      }}
    >
      <Icon size={16} color={colors.ink} strokeWidth={2} />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: font.bodyBold,
          fontSize: 14,
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
        {label}
      </Text>
    </View>
  );
}

type TotalRowProps = {
  icon?: typeof Bike;
  label: string;
  value: string;
};

function TotalRow({ icon: Icon, label, value }: TotalRowProps): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {Icon ? <Icon size={13} color={colors.inkMuted} strokeWidth={2} /> : null}
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 13,
            color: colors.ink,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: font.bodyBold,
          fontSize: 13,
          color: colors.ink,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

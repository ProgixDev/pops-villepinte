import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, LifeBuoy, Navigation, Phone } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import DeliveryStatusPill from "@/components/driver/delivery/DeliveryStatusPill";
import RouteSummary from "@/components/driver/delivery/RouteSummary";
import Screen from "@/components/layout/Screen";
import { colors, shadow } from "@/constants/theme";
import {
  formatDistanceMeters,
  formatDurationMinutes,
  formatPriceEUR,
  formatTimeFR,
} from "@/lib/format";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";
import { useMenuStore } from "@/store/menu.store";
import { useDriverLocationBroadcast } from "@/lib/driver/useDriverLocationBroadcast";
import type { DeliveryStatus } from "@/types/driver";

const NEXT_LABEL: Partial<Record<DeliveryStatus, string>> = {
  assigned: "Accepter la course",
  accepted: "Lancer la navigation",
};

export default function DriverDeliveryDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const delivery = useDeliveriesStore((s) => (id ? s.byId[id] : undefined));
  const respond = useDeliveriesStore((s) => s.respond);
  const fetchDeliveries = useDeliveriesStore((s) => s.fetch);
  // Superadmin support line (configured in the admin dashboard). The call tile
  // only renders when one is set.
  const supportPhone = useMenuStore((s) => s.shopSettings?.support_phone);

  const [busy, setBusy] = useState(false);

  // Broadcast driver location while the delivery is accepted (driver has taken
  // the food at the restaurant and is en route to the customer). The hook
  // handles permission + watchPositionAsync + upsert internally; we just gate
  // it on the lifecycle phase.
  useDriverLocationBroadcast({ active: delivery?.status === "accepted" });

  useEffect(() => {
    // If the store hasn't loaded this assignment yet (e.g. opened via deep
    // link from a push notification), kick a refresh.
    if (id && !delivery) void fetchDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (delivery === undefined || id === undefined) {
    return (
      <Screen>
        <View style={{ padding: 24, alignItems: "center", paddingTop: 80 }}>
          <ActivityIndicator color={colors.ink} />
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 14,
              color: colors.inkMuted,
              marginTop: 12,
            }}
          >
            Chargement de la course…
          </Text>
        </View>
      </Screen>
    );
  }

  const callCustomer = (): void => {
    Linking.openURL(
      `tel:${delivery.customerPhone.replace(/\s+/g, "")}`,
    ).catch(() => {});
  };

  const callSupport = (): void => {
    if (!supportPhone) return;
    Linking.openURL(`tel:${supportPhone.replace(/\s+/g, "")}`).catch(() => {});
  };

  const launchNavigation = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push(`/driver/navigate/${delivery.id}` as never);
  };

  const onPrimary = async (): Promise<void> => {
    if (busy) return;
    if (delivery.status === "assigned") {
      try {
        setBusy(true);
        await respond(delivery.id, "accepted");
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        // Accept = took the food → go straight into turn-by-turn navigation.
        launchNavigation();
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (delivery.status === "accepted") {
      launchNavigation();
    }
  };

  const onDelivered = (): void => {
    // Hand off to the QR scan screen, which confirms + completes the delivery.
    router.push(`/driver/scan/${delivery.id}` as never);
  };

  const primaryLabel = NEXT_LABEL[delivery.status];
  const showDeliveredBtn = delivery.status === "accepted";

  return (
    <Screen
      floatingBottom={
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 32,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 10,
          }}
        >
          {primaryLabel !== undefined ? (
            <PrimaryButton label={primaryLabel} onPress={onPrimary} busy={busy} />
          ) : null}
          {showDeliveredBtn ? (
            <PrimaryButton
              label="Marquer comme livrée"
              onPress={onDelivered}
              busy={busy}
              success
            />
          ) : null}
        </View>
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: 16,
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <ArrowLeft size={24} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 12,
            letterSpacing: 2,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          {delivery.shortCode}
        </Text>
        <View style={{ flex: 1 }} />
        <DeliveryStatusPill status={delivery.status} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 56,
            letterSpacing: -1.5,
            color: colors.ink,
            lineHeight: 60,
          }}
        >
          {delivery.customerName}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 14,
            color: colors.inkMuted,
            marginTop: 4,
          }}
        >
          Reçue à {formatTimeFR(delivery.createdAt)}
          {delivery.distanceMeters > 0
            ? ` · ${formatDistanceMeters(delivery.distanceMeters)}`
            : ""}
          {delivery.estimatedDurationMinutes > 0
            ? ` · ${formatDurationMinutes(delivery.estimatedDurationMinutes)}`
            : ""}
        </Text>
      </View>

      <RouteSummary pickup={delivery.pickup} dropoff={delivery.dropoff} />

      <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 10,
            letterSpacing: 2,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          Commande
        </Text>
        <View
          style={{
            marginTop: 12,
            padding: 20,
            borderRadius: 16,
            backgroundColor: "#F5F5F5",
            gap: 8,
          }}
        >
          {delivery.items.map((item, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 14,
                  color: colors.ink,
                }}
              >
                {item.quantity}× {item.name}
              </Text>
            </View>
          ))}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 10,
                letterSpacing: 2,
                color: colors.inkMuted,
                textTransform: "uppercase",
              }}
            >
              Total client
            </Text>
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 16,
                color: colors.ink,
              }}
            >
              {formatPriceEUR(delivery.totalEUR)}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 10,
                letterSpacing: 2,
                color: colors.inkMuted,
                textTransform: "uppercase",
              }}
            >
              Ta part
            </Text>
            <Text
              style={{
                fontFamily: "BebasNeue_400Regular",
                fontSize: 28,
                letterSpacing: -0.5,
                color: colors.accent,
              }}
            >
              {formatPriceEUR(delivery.driverPayoutEUR)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 24,
          marginTop: 16,
          gap: 12,
        }}
      >
        <ActionTile
          icon={<Phone size={18} color={colors.ink} strokeWidth={2.5} />}
          label="Appeler"
          onPress={callCustomer}
        />
        <ActionTile
          icon={<Navigation size={18} color={colors.ink} strokeWidth={2.5} />}
          label="Navigation"
          onPress={launchNavigation}
        />
        {supportPhone ? (
          <ActionTile
            icon={<LifeBuoy size={18} color={colors.ink} strokeWidth={2.5} />}
            label="Support"
            onPress={callSupport}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function PrimaryButton({
  label,
  onPress,
  success,
  busy,
}: {
  label: string;
  onPress: () => void;
  success?: boolean;
  busy?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={busy ? undefined : onPress}
      disabled={busy}
      style={({ pressed }) => ({
        backgroundColor: success === true ? colors.success : colors.ink,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed || busy ? 0.85 : 1,
        ...shadow.card,
      })}
    >
      {busy ? (
        <ActivityIndicator
          color={success === true ? colors.surface : colors.primary}
        />
      ) : (
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 14,
            letterSpacing: 2,
            color: success === true ? colors.surface : colors.primary,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 13,
          color: colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

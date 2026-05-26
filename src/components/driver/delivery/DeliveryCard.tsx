import { Pressable, Text, View } from "react-native";
import { MapPin, Navigation, Package } from "lucide-react-native";

import { colors, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import type { Delivery } from "@/types/driver";

import DeliveryStatusPill from "./DeliveryStatusPill";

export type DeliveryCardProps = {
  delivery: Delivery;
  onPress: () => void;
};

function formatDistance(m: number): string {
  if (m <= 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export default function DeliveryCard({
  delivery,
  onPress,
}: DeliveryCardProps): React.ReactElement {
  const itemCount = delivery.items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Livraison ${delivery.shortCode}`}
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 24,
        marginBottom: 16,
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <View
        style={[
          {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          },
          shadow.card,
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 12,
              letterSpacing: 2,
              color: colors.ink,
              textTransform: "uppercase",
            }}
          >
            {delivery.shortCode}
          </Text>
          <DeliveryStatusPill status={delivery.status} />
        </View>

        <View style={{ gap: 10 }}>
          <Row
            icon={<Package size={16} color={colors.ink} strokeWidth={2.5} />}
            primary={delivery.pickup.label}
            secondary={`${itemCount} article${itemCount > 1 ? "s" : ""}`}
          />
          <Row
            icon={<MapPin size={16} color={colors.accent} strokeWidth={2.5} />}
            primary={delivery.dropoff.label}
            secondary={delivery.dropoff.line1}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Navigation size={14} color={colors.inkMuted} strokeWidth={2.5} />
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 12,
                color: colors.inkMuted,
              }}
            >
              {formatDistance(delivery.distanceMeters)} ·{" "}
              {formatDuration(delivery.estimatedDurationMinutes)}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "BebasNeue_400Regular",
              fontSize: 22,
              letterSpacing: -0.5,
              color: colors.ink,
            }}
          >
            {formatPriceEUR(delivery.driverPayoutEUR)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Row({
  icon,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary: string;
}): React.ReactElement {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#F5F5F5",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 14,
            lineHeight: 18,
            color: colors.ink,
          }}
        >
          {primary}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 12,
            lineHeight: 16,
            marginTop: 1,
            color: colors.inkMuted,
          }}
          numberOfLines={1}
        >
          {secondary}
        </Text>
      </View>
    </View>
  );
}

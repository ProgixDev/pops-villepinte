import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Clock } from "lucide-react-native";

import { ROUTES } from "@/constants/routes";
import { colors, font, radius, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCountdown } from "@/hooks/useCountdown";
import type { Order } from "@/types";

export type ActiveOrderCardProps = {
  order: Order;
};

export default function ActiveOrderCard({
  order,
}: ActiveOrderCardProps): React.ReactElement {
  const router = useRouter();
  const { minutes, isExpired } = useCountdown(
    order.createdAt,
    order.estimatedReadyAt,
  );

  const itemCount = order.items.reduce((a, i) => a + i.quantity, 0);
  const isReady = order.status === "ready" || isExpired;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir la commande ${order.id}`}
      onPress={() => router.push(ROUTES.orderDetail(order.id))}
      style={{
        marginHorizontal: 20,
        backgroundColor: colors.primary,
        borderRadius: radius.lg,
        padding: 20,
        ...shadow.hero,
      }}
    >
      {/* Top row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: radius.pill,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 10,
              letterSpacing: 2,
              color: colors.primary,
              textTransform: "uppercase",
            }}
          >
            En cours
          </Text>
        </View>
        <ChevronRight size={22} color={colors.ink} strokeWidth={2.5} />
      </View>

      {/* Order ID */}
      <Text
        style={{
          fontFamily: font.display,
          fontSize: 28,
          color: colors.ink,
          letterSpacing: 0.5,
          marginTop: 12,
        }}
      >
        {order.id}
      </Text>

      {/* Info row */}
      <Text
        style={{
          fontFamily: font.body,
          fontSize: 13,
          color: "rgba(0,0,0,0.55)",
          marginTop: 4,
        }}
      >
        {itemCount} article{itemCount > 1 ? "s" : ""} · {formatPriceEUR(order.totalEUR)}
      </Text>

      {/* Bottom row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 16,
          gap: 8,
          backgroundColor: "rgba(0,0,0,0.08)",
          borderRadius: radius.sm,
          paddingHorizontal: 14,
          paddingVertical: 10,
          alignSelf: "flex-start",
        }}
      >
        <Clock size={16} color={colors.ink} strokeWidth={2} />
        <Text
          style={{
            fontFamily: font.bodyBold,
            fontSize: 14,
            color: colors.ink,
          }}
        >
          {isReady ? "C'est prêt ! 🎉" : `Prête dans ~${minutes} min`}
        </Text>
      </View>
    </Pressable>
  );
}

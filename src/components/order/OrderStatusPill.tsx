import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import type { OrderStatus } from "@/types";

type PillConfig = {
  label: string;
  bg: string;
  text: string;
};

const CONFIG: Record<OrderStatus, PillConfig> = {
  received: {
    label: "Reçue",
    bg: colors.border,
    text: colors.inkMuted,
  },
  preparing: {
    label: "En préparation",
    bg: colors.primary,
    text: colors.ink,
  },
  ready: { label: "Prête !", bg: colors.success, text: colors.surface },
  handed_to_livreur: {
    label: "Avec le livreur",
    bg: colors.primaryDark,
    text: colors.ink,
  },
  picked_up: { label: "Récupérée", bg: colors.success, text: colors.surface },
  cancelled: { label: "Annulée", bg: colors.error, text: colors.surface },
};

export type OrderStatusPillProps = {
  status: OrderStatus;
};

export default function OrderStatusPill({
  status,
}: OrderStatusPillProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (status === "ready" && !reducedMotion) {
      scale.value = 0.9;
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [status, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { label, bg, text } = CONFIG[status];

  return (
    <Animated.View
      className="rounded-full"
      style={[
        {
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: bg,
        },
        animatedStyle,
      ]}
    >
      <Text
        className="font-sans-bold uppercase"
        style={{ fontSize: 11, letterSpacing: 2, color: text }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import type { DeliveryStatus } from "@/types/driver";

type PillConfig = {
  label: string;
  bg: string;
  text: string;
};

const CONFIG: Record<DeliveryStatus, PillConfig> = {
  assigned: { label: "Nouvelle", bg: colors.primary, text: colors.ink },
  accepted: { label: "Vers le resto", bg: colors.border, text: colors.inkMuted },
  picked_up: { label: "En route", bg: colors.ink, text: colors.surface },
  delivered: { label: "Livrée", bg: colors.success, text: colors.surface },
  cancelled: { label: "Annulée", bg: colors.error, text: colors.surface },
};

export type DeliveryStatusPillProps = {
  status: DeliveryStatus;
};

export default function DeliveryStatusPill({
  status,
}: DeliveryStatusPillProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (status === "delivered" && !reducedMotion) {
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
      style={[
        {
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: bg,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 11,
          letterSpacing: 2,
          color: text,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

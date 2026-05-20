import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import type { OrderStatus } from "@/types";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 240;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Reçue",
  preparing: "On prépare…",
  ready: "C'est prêt !",
  handed_to_livreur: "Le livreur arrive",
  picked_up: "Récupérée",
  cancelled: "Annulée",
};

function ringColor(s: OrderStatus): string {
  if (s === "ready" || s === "picked_up") return colors.success;
  if (s === "handed_to_livreur") return colors.primaryDark;
  if (s === "cancelled") return colors.error;
  return colors.primary;
}

export type CountdownRingProps = {
  progress: number;
  minutes: number;
  seconds: number;
  status: OrderStatus;
};

export default function CountdownRing({
  progress,
  minutes,
  seconds,
  status,
}: CountdownRingProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const animatedProgress = useSharedValue(reducedMotion ? progress : 0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    animatedProgress.value = reducedMotion
      ? progress
      : withTiming(progress, { duration: 900 });
  }, [progress, reducedMotion, animatedProgress]);

  useEffect(() => {
    if (status === "ready" && !reducedMotion) {
      pulseScale.value = withRepeat(
        withTiming(1.05, { duration: 1200 }),
        -1,
        true,
      );
    } else {
      pulseScale.value = 1;
    }
  }, [status, reducedMotion, pulseScale]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  const timerPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const isCancelled = status === "cancelled";
  const isReady = status === "ready" || status === "picked_up";
  const pad = (n: number): string => String(n).padStart(2, "0");
  const timerText = isCancelled
    ? "—:——"
    : `${pad(minutes)}:${pad(seconds)}`;
  const timerColor = isCancelled
    ? colors.error
    : isReady
      ? colors.success
      : colors.ink;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <Svg
        width={SIZE}
        height={SIZE}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={ringColor(status)}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedProps}
          fill="none"
        />
      </Svg>

      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          },
          timerPulseStyle,
        ]}
      >
        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 52,
            letterSpacing: -2,
            color: timerColor,
          }}
        >
          {timerText}
        </Text>
        <Text
          className="font-sans-semibold"
          style={{
            fontSize: 14,
            marginTop: 8,
            color: isReady
              ? colors.success
              : isCancelled
                ? colors.error
                : colors.inkMuted,
          }}
        >
          {STATUS_LABELS[status]}
        </Text>
      </Animated.View>
    </View>
  );
}

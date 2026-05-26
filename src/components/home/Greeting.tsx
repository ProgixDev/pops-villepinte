import { useEffect, useMemo } from "react";
import { Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type GreetingProps = {
  name: string;
  /**
   * Optional override for the line below the greeting. Defaults to the
   * customer-facing question. The driver Home passes its own status copy
   * (e.g. "Tu es en ligne. On t'envoie une course.").
   */
  subtitle?: string;
};

function formatFrenchDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export default function Greeting({
  name,
  subtitle,
}: GreetingProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 12);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withTiming(1, { duration: 500 });
    translateY.value = withTiming(0, { duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 18 ? "Bonjour" : "Bonsoir";
  }, []);

  const dateLabel = useMemo(() => formatFrenchDate(new Date()), []);

  return (
    <Animated.View style={animatedStyle}>
      <Text
        className="font-sans-semibold text-on-surface-variant uppercase"
        style={{ fontSize: 11, letterSpacing: 3 }}
      >
        Villepinte · {dateLabel}
      </Text>

      <Text
        className="font-sans-extrabold-italic text-on-surface"
        style={{
          fontSize: 44,
          lineHeight: 48,
          letterSpacing: -1.5,
          marginTop: 12,
        }}
      >
        {greeting}, {name}.
      </Text>

      <Text
        className="font-sans-semibold text-on-surface-variant"
        style={{ fontSize: 22, lineHeight: 28, marginTop: 6 }}
      >
        {subtitle ?? "Qu'est-ce qui vous fait envie ?"}
      </Text>
    </Animated.View>
  );
}

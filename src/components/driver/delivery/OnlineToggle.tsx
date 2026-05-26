import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, shadow } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type OnlineToggleProps = {
  online: boolean;
  onToggle: () => void;
};

export default function OnlineToggle({
  online,
  onToggle,
}: OnlineToggleProps): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg = online ? colors.success : colors.ink;
  const label = online ? "EN LIGNE" : "HORS LIGNE";
  const sub = online ? "Tu reçois les courses" : "Touche pour démarrer";

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={online ? "Passer hors ligne" : "Passer en ligne"}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onToggle();
      }}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 160 });
      }}
      style={[
        {
          marginHorizontal: 24,
          paddingVertical: 18,
          paddingHorizontal: 24,
          borderRadius: 16,
          backgroundColor: bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        shadow.card,
        animatedStyle,
      ]}
    >
      <View>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 18,
            letterSpacing: 3,
            color: online ? colors.surface : colors.primary,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 12,
            color: online ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.7)",
            marginTop: 2,
          }}
        >
          {sub}
        </Text>
      </View>

      <View
        style={{
          width: 56,
          height: 30,
          borderRadius: 15,
          backgroundColor: "rgba(0,0,0,0.25)",
          padding: 3,
          alignItems: online ? "flex-end" : "flex-start",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.surface,
          }}
        />
      </View>
    </AnimatedPressable>
  );
}

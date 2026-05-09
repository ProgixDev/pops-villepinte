import { Pressable } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, shadow } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type IconButtonVariant = "light" | "dark";

export type IconButtonProps = {
  icon: LucideIcon;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number;
  accessibilityLabel?: string;
};

export default function IconButton({
  icon: Icon,
  onPress,
  variant = "light",
  size = 44,
  accessibilityLabel,
}: IconButtonProps): React.ReactElement {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const isLight = variant === "light";
  const iconColor = isLight ? colors.ink : colors.surface;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.92, { duration: 120 });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 160 });
      }}
      hitSlop={8}
      className="items-center justify-center rounded-full"
      style={[
        {
          width: size,
          height: size,
          backgroundColor: isLight ? colors.surface : colors.ink,
        },
        isLight ? shadow.card : null,
        animatedStyle,
      ]}
    >
      <Icon size={Math.round(size * 0.45)} color={iconColor} strokeWidth={2} />
    </AnimatedPressable>
  );
}

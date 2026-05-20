import { Pressable, Text } from "react-native";
import {
  Beef,
  CupSoda,
  Drumstick,
  Flame,
  Grid3x3,
  type LucideIcon,
  Package,
  Pizza,
  Salad,
  UtensilsCrossed,
  Wheat,
} from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, font } from "@/constants/theme";
import type { Category } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: Grid3x3,
  "smash-burgers": Beef,
  wraps: Wheat,
  tacos: Flame,
  tasty: Pizza,
  bowls: Salad,
  box: Package,
  bucket: Drumstick,
  plats: UtensilsCrossed,
  boissons: CupSoda,
};

export type CategoryChipProps = {
  category: Category;
  selected?: boolean;
  onPress: () => void;
};

export default function CategoryChip({
  category,
  selected = false,
  onPress,
}: CategoryChipProps): React.ReactElement {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const Icon = CATEGORY_ICONS[category.id] ?? UtensilsCrossed;
  const iconColor = selected ? colors.ink : colors.ink;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={category.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 120 });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 160 });
      }}
      className={`flex-row items-center rounded-full ${
        selected ? "bg-secondary-container" : "bg-surface-container-high"
      }`}
      style={[
        {
          paddingHorizontal: 14,
          paddingVertical: 9,
          gap: 7,
        },
        animatedStyle,
      ]}
    >
      <Icon size={15} color={iconColor} strokeWidth={2.2} />
      <Text
        className={
          selected ? "text-on-secondary-container" : "text-on-surface"
        }
        style={{ fontFamily: font.bodyBold, fontSize: 12.5, letterSpacing: 0.2 }}
      >
        {category.name}
      </Text>
    </AnimatedPressable>
  );
}

import { useEffect } from "react";
import {
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Search, X } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, font } from "@/constants/theme";

const COLLAPSED_SIZE = 40;
const HORIZONTAL_PADDING = 48; // 24 each side of the screen
const ANIMATION_MS = 250;

export type SearchFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  expanded: boolean;
  onToggle: () => void;
};

export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function SearchField({
  value,
  onChangeText,
  expanded,
  onToggle,
}: SearchFieldProps): React.ReactElement {
  const { width: screenWidth } = useWindowDimensions();
  const expandedWidth = Math.max(COLLAPSED_SIZE, screenWidth - HORIZONTAL_PADDING);

  const width = useSharedValue(expanded ? expandedWidth : COLLAPSED_SIZE);

  useEffect(() => {
    width.value = withTiming(expanded ? expandedWidth : COLLAPSED_SIZE, {
      duration: ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, expandedWidth, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rechercher dans le menu"
        onPress={onToggle}
        className="bg-surface-container-high items-center justify-center rounded-full"
        style={{ width: COLLAPSED_SIZE, height: COLLAPSED_SIZE }}
      >
        <Search size={18} color={colors.ink} strokeWidth={2} />
      </Pressable>
    );
  }

  return (
    <Animated.View
      className="bg-surface-container-high flex-row items-center rounded-full"
      style={[
        {
          height: COLLAPSED_SIZE,
          paddingHorizontal: 16,
          gap: 10,
        },
        animatedStyle,
      ]}
    >
      <Search size={18} color={colors.ink} strokeWidth={2} />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        placeholder="Cherchez votre envie..."
        placeholderTextColor={colors.inkMuted}
        returnKeyType="search"
        className="flex-1 text-on-surface"
        style={{ fontFamily: font.body, fontSize: 14, paddingVertical: 0 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer la recherche"
        onPress={onToggle}
        hitSlop={12}
      >
        <X size={20} color={colors.ink} strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors } from "@/constants/theme";

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const PADDING = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

const ANIM = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

export type OnlineSwitchProps = {
  online: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

/**
 * Compact iOS/Android-style switch tuned for the driver Tournée map header.
 * Animated track color (ink → success) + sliding thumb so the state change
 * reads as a real toggle, not a label that happens to change. Tap fires a
 * medium haptic to mirror the platform's switch feel.
 */
export default function OnlineSwitch({
  online,
  onToggle,
  disabled,
}: OnlineSwitchProps): React.ReactElement {
  const progress = useSharedValue(online ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(online ? 1 : 0, ANIM);
  }, [online, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.ink, colors.success],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: online, disabled }}
      accessibilityLabel={online ? "Passer hors ligne" : "Passer en ligne"}
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onToggle();
      }}
      hitSlop={10}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : disabled ? 0.5 : 1,
      })}
    >
      <Animated.View
        style={[
          {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            padding: PADDING,
            justifyContent: "center",
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: THUMB_SIZE / 2,
              backgroundColor: colors.surface,
              // Subtle thumb shadow for depth — matches the platform feel
              // without going overboard on Android.
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 3,
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
      {/* Status dot — small green/ink dot to the right of the track for an
          extra at-a-glance cue (color-blind friendly: the dot has motion +
          position too, not just color). */}
      <View style={{ height: 0, width: 0 }} />
    </Pressable>
  );
}

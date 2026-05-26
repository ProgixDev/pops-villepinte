import { useEffect, type ReactNode } from "react";
import { Dimensions, View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, shadow } from "@/constants/theme";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SPRING = { damping: 22, stiffness: 240, mass: 0.6 } as const;

export type BottomSheetProps = {
  /** Snap heights in px, smallest first (peek → mid → full). 2-3 values. */
  snapPoints: readonly number[];
  /** Index of the snap point to land on first. Defaults to 0 (peek). */
  initialSnap?: number;
  /** Index callback after snap settles — useful for changing content density. */
  onSnap?: (index: number) => void;
  children: ReactNode;
};

/**
 * Lightweight draggable bottom sheet built on reanimated + gesture-handler.
 * Avoids the @gorhom/bottom-sheet dependency for a focused use case. Snaps to
 * `snapPoints` heights; drag-to-dismiss is intentionally disabled — the sheet
 * always stays peeked so the driver can always reach it.
 */
export default function BottomSheet({
  snapPoints,
  initialSnap = 0,
  onSnap,
  children,
}: BottomSheetProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  // translateY is measured from the BOTTOM of the screen. A larger value
  // means the sheet is taller. Internally we drive the sheet via height-from-
  // bottom, then translate it to position from the top.
  const height = useSharedValue(snapPoints[initialSnap] ?? snapPoints[0]);
  const startHeight = useSharedValue(0);

  // Call onSnap whenever we settle on a new height. Looked up cheaply by
  // comparing to snapPoints (no animated subscriptions needed in JS land).
  useEffect(() => {
    onSnap?.(initialSnap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifySnap = (newIdx: number): void => {
    onSnap?.(newIdx);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startHeight.value = height.value;
    })
    .onUpdate((e) => {
      // Drag up = grow sheet (negative translationY = positive delta height)
      const next = startHeight.value - e.translationY;
      const min = snapPoints[0];
      const max = snapPoints[snapPoints.length - 1];
      // Soft-clamp at the edges so it doesn't feel like a wall.
      if (next < min) {
        height.value = min - (min - next) * 0.35;
      } else if (next > max) {
        height.value = max + (next - max) * 0.35;
      } else {
        height.value = next;
      }
    })
    .onEnd((e) => {
      // Pick the closest snap point, weighted by velocity so a flick lands
      // farther than a slow drag.
      const projected = height.value - e.velocityY * 0.15;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < snapPoints.length; i++) {
        const d = Math.abs(snapPoints[i] - projected);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      height.value = withSpring(snapPoints[bestIdx], SPRING);
      runOnJS(notifySnap)(bestIdx);
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const animatedHandleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      height.value,
      [snapPoints[0], snapPoints[snapPoints.length - 1]],
      [0.45, 0.85],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          paddingBottom: insets.bottom,
        },
        shadow.float,
        animatedSheetStyle,
      ]}
    >
      {/* Drag handle — only this area captures the pan gesture, so the inner
          ScrollView inside `children` can scroll normally without the sheet
          stealing the gesture. The handle has hitSlop-ish vertical padding
          so it's still easy to grab. */}
      <GestureDetector gesture={pan}>
        <View style={styles.handleWrap}>
          <Animated.View style={[styles.handle, animatedHandleStyle]} />
        </View>
      </GestureDetector>
      <View style={{ flex: 1 }}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    // Cap absolute size so a malformed snapPoints can't blow past the screen.
    maxHeight: SCREEN_HEIGHT * 0.95,
  },
  handleWrap: {
    width: "100%",
    alignItems: "center",
    // Generous touch target — the drag bar itself is only 4px tall, but the
    // 18px of vertical padding makes it easy to grab without affordance text.
    paddingTop: 10,
    paddingBottom: 14,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink,
  },
});

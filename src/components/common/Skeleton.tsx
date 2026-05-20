import { useEffect } from "react";
import { Dimensions, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SHIMMER_DURATION_MS = 1100;
const SHIMMER_MIN_OPACITY = 0.55;
const SHIMMER_MAX_OPACITY = 1;
const BASE_BG = "#F2EFE2";
const TINT = colors.primary;

function useShimmer() {
  const progress = useSharedValue(SHIMMER_MIN_OPACITY);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(SHIMMER_MAX_OPACITY, {
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [progress]);
  return progress;
}

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({
  width = "100%",
  height = 16,
  radius: r = 8,
  style,
}: SkeletonProps): React.ReactElement {
  const progress = useShimmer();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: BASE_BG,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: TINT,
            opacity: 0.5,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

export function SkeletonText({
  lines = 1,
  lastLineWidth = "60%",
  lineHeight = 14,
  gap = 8,
}: {
  lines?: number;
  lastLineWidth?: `${number}%`;
  lineHeight?: number;
  gap?: number;
}): React.ReactElement {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : "100%"}
          radius={6}
        />
      ))}
    </View>
  );
}

export function SkeletonProductRow(): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 16,
        gap: 16,
      }}
    >
      <Skeleton width={112} height={112} radius={radius.lg} />
      <View style={{ flex: 1, minHeight: 112, justifyContent: "space-between" }}>
        <View style={{ gap: 8 }}>
          <Skeleton width={48} height={14} radius={radius.pill} />
          <Skeleton width="80%" height={18} radius={6} />
          <Skeleton width="95%" height={12} radius={6} />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Skeleton width={64} height={20} radius={6} />
          <Skeleton width={36} height={36} radius={18} />
        </View>
      </View>
    </View>
  );
}

const HERO_H_PADDING = 20;
const HERO_SLIDE_WIDTH = SCREEN_WIDTH - HERO_H_PADDING * 2;

export function SkeletonHeroSlide(): React.ReactElement {
  return (
    <View style={{ marginTop: 16, paddingHorizontal: HERO_H_PADDING }}>
      <Skeleton width={HERO_SLIDE_WIDTH} height={220} radius={radius.xl} />
    </View>
  );
}

export function SkeletonTopPickCard({
  width: w,
}: {
  width: number;
}): React.ReactElement {
  return (
    <View style={{ width: w, backgroundColor: colors.white }}>
      <Skeleton width={w} height={w * 0.85} radius={radius.lg} />
      <View style={{ padding: 12, gap: 8 }}>
        <Skeleton width="80%" height={15} radius={6} />
        <Skeleton width={64} height={16} radius={6} />
      </View>
    </View>
  );
}

export function SkeletonChip(): React.ReactElement {
  return <Skeleton width={88} height={32} radius={radius.pill} />;
}

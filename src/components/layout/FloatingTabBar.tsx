import { useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { colors, font, radius } from "@/constants/theme";

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
// Per-platform blur tuning. iOS uses a system material tint that the OS
// renders with the same backdrop pipeline as native liquid glass, so the
// fallback on pre-iOS 26 looks ~indistinguishable from the GlassView branch.
// Android's BlurView can't access system materials, so it gets a higher
// intensity + a stronger white overlay to compensate.
const BLUR_INTENSITY = Platform.OS === "android" ? 80 : 70;
const BLUR_TINT: "systemThinMaterialLight" | "light" =
  Platform.OS === "ios" ? "systemThinMaterialLight" : "light";

/**
 * Glass container that renders true iOS 26 liquid glass when supported, and
 * falls back to a frosted BlurView tuned to mimic the same look everywhere
 * else.
 */
function GlassContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewProps["style"];
}): React.ReactElement {
  if (HAS_LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView
      intensity={BLUR_INTENSITY}
      tint={BLUR_TINT}
      style={[
        Platform.OS === "ios" ? styles.blurFallbackIos : styles.blurFallbackAndroid,
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const BAR_HEIGHT = 68;
const BAR_HORIZONTAL_MARGIN = 20;
const BAR_BOTTOM_OFFSET = 12;
const BAR_INNER_PADDING = 8;
const INDICATOR_VERTICAL_INSET = 6;

const SPRING_CONFIG = { damping: 18, stiffness: 220, mass: 0.6 } as const;

type TabItemProps = {
  focused: boolean;
  label: string;
  renderIcon: (color: string) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

function TabItem({
  focused,
  label,
  renderIcon,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: TabItemProps): React.ReactElement {
  const pressScale = useSharedValue(1);
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, progress]);

  const iconWrapStyle = useAnimatedStyle(() => {
    const lift = interpolate(progress.value, [0, 1], [0, -2]);
    const scale = interpolate(progress.value, [0, 1], [1, 1.12]) * pressScale.value;
    return {
      transform: [{ translateY: lift }, { scale }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 1],
      [colors.inkMuted, colors.ink],
    );
    return {
      color,
      opacity: interpolate(progress.value, [0, 1], [0.7, 1]),
      transform: [{ translateY: interpolate(progress.value, [0, 1], [1, 0]) }],
    };
  });

  // Static color for icons rendered by upstream tabBarIcon (they receive a
  // plain string, not an animated value).
  const iconColor = focused ? colors.ink : colors.inkMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPressIn={() => {
        pressScale.value = withSpring(0.88, SPRING_CONFIG);
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, SPRING_CONFIG);
      }}
      onPress={() => {
        if (Platform.OS === "ios") {
          void Haptics.selectionAsync();
        }
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.itemPressable}
    >
      <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
        {renderIcon(iconColor)}
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = useState(0);

  // Animated index — drives the sliding pill. Use a float so the spring lands
  // smoothly between tabs.
  const indexProgress = useSharedValue(state.index);

  useEffect(() => {
    indexProgress.value = withSpring(state.index, SPRING_CONFIG);
  }, [state.index, indexProgress]);

  const tabCount = state.routes.length;
  // `innerWidth` measures the outer width of `inner` (includes its horizontal
  // padding). The tab Pressables flex inside the content area, so the true
  // per-tab width is the content area divided by tab count. Using the raw
  // `innerWidth / tabCount` makes the indicator pill ~4px wider than each tab
  // and visually de-centers the icon inside the pill.
  const tabContentWidth = Math.max(innerWidth - BAR_INNER_PADDING * 2, 0);
  const tabWidth = tabCount > 0 ? tabContentWidth / tabCount : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: indexProgress.value * tabWidth }],
  }));

  const onInnerLayout = (e: LayoutChangeEvent) => {
    setInnerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: insets.bottom > 0 ? insets.bottom : BAR_BOTTOM_OFFSET,
        },
      ]}
    >
      <GlassContainer style={styles.bar}>
        <View style={styles.inner} onLayout={onInnerLayout}>
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, indicatorStyle]}
            />
          ) : null}

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : typeof options.title === "string"
                  ? options.title
                  : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            const renderIcon = (color: string) => {
              if (typeof options.tabBarIcon === "function") {
                return options.tabBarIcon({ focused, color, size: 22 });
              }
              return null;
            };

            return (
              <TabItem
                key={route.key}
                focused={focused}
                label={label}
                renderIcon={renderIcon}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </View>
      </GlassContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: BAR_HORIZONTAL_MARGIN,
    right: BAR_HORIZONTAL_MARGIN,
    alignItems: "stretch",
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  // iOS pre-liquid-glass: the `systemThinMaterialLight` tint already mimics
  // Apple's native glass material, so we only need a hint of overlay to give
  // the bar a slight body. Heavier overlay would obscure the blurred content
  // and break the glass illusion.
  blurFallbackIos: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
  },
  // Android BlurView lacks system materials, so we add a stronger white wash
  // + a hairline border to fake the same frosted-glass feel.
  blurFallbackAndroid: {
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.6)",
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: BAR_INNER_PADDING,
    alignItems: "center",
  },
  indicator: {
    position: "absolute",
    top: INDICATOR_VERTICAL_INSET,
    bottom: INDICATOR_VERTICAL_INSET,
    left: BAR_INNER_PADDING,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  itemPressable: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 1,
  },
});

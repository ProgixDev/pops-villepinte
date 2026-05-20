import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ROUTES } from "@/constants/routes";
import { colors, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import type { Product } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ENTRANCE_DELAY_MS = 150;

export type CravingCardProps = {
  product: Product;
};

export default function CravingCard({
  product,
}: CravingCardProps): React.ReactElement {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const mountScale = useSharedValue(reducedMotion ? 1 : 0.9);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withDelay(
      ENTRANCE_DELAY_MS,
      withTiming(1, { duration: 450 }),
    );
    mountScale.value = withDelay(
      ENTRANCE_DELAY_MS,
      withSpring(1, { damping: 14, stiffness: 130 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: mountScale.value * pressScale.value }],
  }));

  const handlePress = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(ROUTES.productDetail(product.id));
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`Commander ${product.name}`}
      onPress={handlePress}
      onPressIn={() => {
        pressScale.value = withTiming(0.97, { duration: 120 });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 160 });
      }}
      className="bg-primary-container rounded-xl"
      style={[
        {
          aspectRatio: 16 / 11,
          padding: 24,
          overflow: "visible",
        },
        shadow.hero,
        animatedStyle,
      ]}
    >
      {/* Left column — text content */}
      <View style={{ maxWidth: "62%", flex: 1, justifyContent: "space-between" }}>
        <View>
          <View
            className="bg-secondary-container self-start rounded-full"
            style={{ paddingHorizontal: 10, paddingVertical: 4 }}
          >
            <Text
              className="font-sans-bold text-on-secondary-container"
              style={{ fontSize: 10, letterSpacing: 2 }}
            >
              SIGNATURE POP&apos;S
            </Text>
          </View>

          <Text
            numberOfLines={2}
            className="font-sans-extrabold"
            style={{
              fontSize: 32,
              lineHeight: 34,
              letterSpacing: -1,
              color: colors.surface,
              marginTop: 12,
            }}
          >
            {product.name}
          </Text>

          <Text
            numberOfLines={2}
            className="font-sans"
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: "rgba(253,249,238,0.72)",
              marginTop: 8,
            }}
          >
            {product.description}
          </Text>
        </View>

        <View className="flex-row items-center justify-between" style={{ marginTop: 16 }}>
          <Text
            className="font-sans-extrabold-italic"
            style={{
              fontSize: 28,
              lineHeight: 30,
              color: colors.surface,
            }}
          >
            {formatPriceEUR(product.price_eur)}
          </Text>

          <View
            className="flex-row items-center bg-surface rounded-full"
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              gap: 6,
            }}
          >
            <Text
              className="font-sans-bold text-primary"
              style={{ fontSize: 13 }}
            >
              Commander
            </Text>
            <ArrowRight size={16} color={colors.primary} strokeWidth={2.5} />
          </View>
        </View>
      </View>

      {/* Bleeding hero image */}
      <Image
        source={product.image_url}
        contentFit="contain"
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: "55%",
          aspectRatio: 1,
        }}
        accessibilityIgnoresInvertColors
      />
    </AnimatedPressable>
  );
}

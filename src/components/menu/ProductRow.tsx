import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ROUTES } from "@/constants/routes";
import { colors, font } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import type { Product } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STAGGER_STEP_MS = 30;
const STAGGER_CAP_MS = 300;
const ENTRANCE_DURATION_MS = 300;
// Only the first N rows get a staggered entrance animation. Rows beyond this
// snap to their final state — rendering them animated would create ~3 timing
// animations per row on mount, which adds up to noticeable jank on lists with
// 20+ products.
const ENTRANCE_ROW_LIMIT = 6;

export type ProductRowProps = {
  product: Product;
  index: number;
};

function ProductRow({
  product,
  index,
}: ProductRowProps): React.ReactElement {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const addItem = useCartStore((s) => s.addItem);

  const animateEntrance = !reducedMotion && index < ENTRANCE_ROW_LIMIT;
  const opacity = useSharedValue(animateEntrance ? 0 : 1);
  const translateY = useSharedValue(animateEntrance ? 8 : 0);
  const pressScale = useSharedValue(1);
  const addPressScale = useSharedValue(1);

  useEffect(() => {
    if (!animateEntrance) return;
    const delay = Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS);
    opacity.value = withDelay(delay, withTiming(1, { duration: ENTRANCE_DURATION_MS }));
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: ENTRANCE_DURATION_MS }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: pressScale.value },
    ],
  }));

  const addButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addPressScale.value }],
  }));

  const hasVariants = product.product_variants !== undefined && product.product_variants.length > 0;

  const handlePress = (): void => {
    router.push(ROUTES.productDetail(product.id));
  };

  const handleAdd = (): void => {
    if (hasVariants) {
      router.push(ROUTES.productDetail(product.id));
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem({
      productId: product.id,
      quantity: 1,
      supplements: [],
    });
  };

  const priceLabel = `${hasVariants ? "dès " : ""}${formatPriceEUR(product.price_eur)}`;
  const firstTag = product.tags[0];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={product.name}
      onPress={handlePress}
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 120 });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 160 });
      }}
      className="flex-row items-center"
      style={[
        {
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        containerStyle,
      ]}
    >
      <View
        className="bg-surface-container-highest rounded-xl overflow-hidden"
        style={{ width: 88, height: 88 }}
      >
        <Image
          source={product.image_url}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={product.id}
          transition={150}
          style={{ width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
        />
        {firstTag !== undefined ? (
          <View
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              backgroundColor: colors.primary,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 8.5,
                letterSpacing: 1.4,
                color: colors.ink,
              }}
            >
              {firstTag}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        className="flex-1"
        style={{ minHeight: 88, justifyContent: "space-between", paddingVertical: 2 }}
      >
        <View>
          <Text
            numberOfLines={1}
            className="text-on-surface"
            style={{
              fontFamily: font.bodyBold,
              fontSize: 16,
              lineHeight: 20,
              letterSpacing: -0.2,
            }}
          >
            {product.name}
          </Text>

          <Text
            numberOfLines={2}
            className="text-on-surface-variant"
            style={{
              fontFamily: font.body,
              fontSize: 12,
              lineHeight: 16,
              marginTop: 2,
            }}
          >
            {product.description}
          </Text>
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{ marginTop: 6 }}
        >
          <Text
            className="text-primary"
            style={{
              fontFamily: font.bodyExtraBoldItalic,
              fontSize: 19,
              lineHeight: 22,
            }}
          >
            {priceLabel}
          </Text>

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={
              hasVariants
                ? `Personnaliser ${product.name}`
                : `Ajouter ${product.name} au panier`
            }
            onPress={handleAdd}
            onPressIn={() => {
              addPressScale.value = withTiming(0.92, { duration: 120 });
            }}
            onPressOut={() => {
              addPressScale.value = withTiming(1, { duration: 160 });
            }}
            hitSlop={10}
            className="bg-on-surface items-center justify-center rounded-full"
            style={[{ width: 32, height: 32 }, addButtonStyle]}
          >
            <Plus size={16} color={colors.surface} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

// Rows past the entrance-animation cap don't depend on `index` for rendering
// (they snap to final state), so treat any index >= ENTRANCE_ROW_LIMIT change
// as no-op to avoid re-renders when a parent map's iteration order shifts.
export default memo(ProductRow, (prev, next) =>
  prev.product === next.product &&
  (prev.index === next.index ||
    (prev.index >= ENTRANCE_ROW_LIMIT && next.index >= ENTRANCE_ROW_LIMIT)),
);

import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
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
import { colors } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import type { Product } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STAGGER_STEP_MS = 30;
const STAGGER_CAP_MS = 300;
const ENTRANCE_DURATION_MS = 300;

export type ProductRowProps = {
  product: Product;
  index: number;
};

export default function ProductRow({
  product,
  index,
}: ProductRowProps): React.ReactElement {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const addItem = useCartStore((s) => s.addItem);

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 8);
  const pressScale = useSharedValue(1);
  const addPressScale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
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
        { paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
        containerStyle,
      ]}
    >
      <View
        className="bg-surface-container-highest rounded-lg overflow-hidden"
        style={{ width: 112, height: 112 }}
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
      </View>

      <View
        className="flex-1 justify-between"
        style={{ minHeight: 112, paddingVertical: 4 }}
      >
        <View>
          {firstTag !== undefined ? (
            <View
              className="bg-primary self-start rounded-full"
              style={{ paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 }}
            >
              <Text
                className="font-sans-bold"
                style={{
                  fontSize: 9,
                  letterSpacing: 2,
                  color: colors.surface,
                }}
              >
                {firstTag}
              </Text>
            </View>
          ) : null}

          <Text
            numberOfLines={2}
            className="font-sans-bold text-on-surface"
            style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.3 }}
          >
            {product.name}
          </Text>

          <Text
            numberOfLines={1}
            className="font-sans text-on-surface-variant"
            style={{ fontSize: 13, lineHeight: 18, marginTop: 2 }}
          >
            {product.description}
          </Text>
        </View>

        <View
          className="flex-row items-end justify-between"
          style={{ marginTop: "auto" }}
        >
          <Text
            className="font-sans-extrabold-italic text-primary"
            style={{ fontSize: 22, lineHeight: 24 }}
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
            hitSlop={8}
            className="bg-on-surface items-center justify-center rounded-full"
            style={[{ width: 36, height: 36 }, addButtonStyle]}
          >
            <Plus size={18} color={colors.surface} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

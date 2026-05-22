import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Heart, Plus } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ROUTES } from "@/constants/routes";
import { colors, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import { useFavoritesStore } from "@/store/favorites.store";
import type { Product } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ProductCardSize = "sm" | "md";

export type ProductCardProps = {
  product: Product;
  size?: ProductCardSize;
};

type Sizing = {
  width?: number;
  height: number;
  nameFontSize: number;
  priceFontSize: number;
  padding: number;
};

const SIZING: Record<ProductCardSize, Sizing> = {
  md: {
    width: 220,
    height: 280,
    nameFontSize: 16,
    priceFontSize: 20,
    padding: 16,
  },
  sm: {
    // No fixed width — parent container controls it (used in the Nouveautés grid).
    height: 220,
    nameFontSize: 14,
    priceFontSize: 16,
    padding: 12,
  },
};

export default function ProductCard({
  product,
  size = "md",
}: ProductCardProps): React.ReactElement {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const isFavorite = useFavoritesStore((s) =>
    s.productIds.includes(product.id),
  );
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const pressScale = useSharedValue(1);
  const addPressScale = useSharedValue(1);
  const favPressScale = useSharedValue(1);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const animatedAddStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addPressScale.value }],
  }));
  const animatedFavStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favPressScale.value }],
  }));

  const sizing = SIZING[size];

  const handlePress = (): void => {
    router.push(ROUTES.productDetail(product.id));
  };

  const handleAdd = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem({
      productId: product.id,
      variantId: product.product_variants?.[0]?.id,
      quantity: 1,
      supplements: [],
    });
  };

  const handleToggleFavorite = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void toggleFavorite(product.id);
  };

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
      className="bg-surface-container-lowest rounded-xl overflow-hidden"
      style={[
        {
          width: sizing.width,
          height: sizing.height,
        },
        shadow.card,
        animatedCardStyle,
      ]}
    >
      {/* Image region — top 65% */}
      <View style={{ flex: 0.65, position: "relative" }}>
        <Image
          source={product.image_url}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
        />

        {product.tags.length > 0 ? (
          <View
            className="flex-row"
            style={{ position: "absolute", top: 12, left: 12, gap: 6 }}
          >
            {product.tags.map((tag) => (
              <View
                key={tag}
                className="bg-primary rounded-full"
                style={{ paddingHorizontal: 8, paddingVertical: 3 }}
              >
                <Text
                  className="font-sans-bold text-surface"
                  style={{ fontSize: 9, letterSpacing: 2 }}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite
              ? `Retirer ${product.name} des favoris`
              : `Ajouter ${product.name} aux favoris`
          }
          accessibilityState={{ selected: isFavorite }}
          onPress={handleToggleFavorite}
          onPressIn={() => {
            favPressScale.value = withTiming(0.88, { duration: 120 });
          }}
          onPressOut={() => {
            favPressScale.value = withTiming(1, { duration: 160 });
          }}
          hitSlop={8}
          className="bg-surface-container-lowest items-center justify-center rounded-full"
          style={[
            {
              position: "absolute",
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              shadowColor: colors.ink,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            },
            animatedFavStyle,
          ]}
        >
          <Heart
            size={16}
            color={colors.primary}
            strokeWidth={2}
            fill={isFavorite ? colors.primary : "transparent"}
          />
        </AnimatedPressable>
      </View>

      {/* Body region — bottom 35% */}
      <View
        style={{
          flex: 0.35,
          padding: sizing.padding,
          justifyContent: "space-between",
        }}
      >
        <Text
          numberOfLines={2}
          className="font-sans-bold text-on-surface"
          style={{
            fontSize: sizing.nameFontSize,
            lineHeight: sizing.nameFontSize + 4,
          }}
        >
          {product.name}
        </Text>

        <View className="flex-row items-center justify-between">
          <Text
            className="font-sans-extrabold-italic text-primary"
            style={{ fontSize: sizing.priceFontSize }}
          >
            {formatPriceEUR(product.price_eur)}
          </Text>

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${product.name} au panier`}
            onPress={handleAdd}
            onPressIn={() => {
              addPressScale.value = withTiming(0.92, { duration: 120 });
            }}
            onPressOut={() => {
              addPressScale.value = withTiming(1, { duration: 160 });
            }}
            hitSlop={8}
            className="bg-on-surface items-center justify-center rounded-full"
            style={[
              { width: 36, height: 36 },
              animatedAddStyle,
            ]}
          >
            <Plus size={18} color={colors.surface} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import type { Product } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CartSuggestionCardProps = {
  product: Product;
};

export default function CartSuggestionCard({
  product,
}: CartSuggestionCardProps): React.ReactElement {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const cardScale = useSharedValue(1);
  const addScale = useSharedValue(1);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const addStyle = useAnimatedStyle(() => ({
    transform: [{ scale: addScale.value }],
  }));

  const hasVariants = product.product_variants !== undefined && product.product_variants.length > 0;

  const handleCardPress = (): void => {
    router.push({ pathname: "/product/[id]", params: { id: product.id } });
  };

  const handleAdd = (): void => {
    if (hasVariants) {
      router.push({ pathname: "/product/[id]", params: { id: product.id } });
      return;
    }
    void Haptics.selectionAsync();
    addItem({
      productId: product.id,
      quantity: 1,
      supplements: [],
    });
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={product.name}
      onPress={handleCardPress}
      onPressIn={() => {
        cardScale.value = withTiming(0.98, { duration: 120 });
      }}
      onPressOut={() => {
        cardScale.value = withTiming(1, { duration: 160 });
      }}
      className="bg-surface-container-lowest rounded-xl overflow-hidden"
      style={[{ width: 140 }, cardStyle]}
    >
      <View style={{ height: 100 }}>
        <Image
          source={product.image_url}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={{ padding: 12 }}>
        <Text
          numberOfLines={2}
          className="font-sans-bold text-on-surface"
          style={{ fontSize: 12, lineHeight: 16, height: 32 }}
        >
          {product.name}
        </Text>

        <View
          className="flex-row items-center justify-between"
          style={{ marginTop: 8 }}
        >
          <Text
            className="text-primary"
            style={{
              fontFamily: "BebasNeue_400Regular",
              fontSize: 14,
            }}
          >
            {hasVariants ? "dès " : ""}
            {formatPriceEUR(product.price_eur)}
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
              addScale.value = withTiming(0.9, { duration: 120 });
            }}
            onPressOut={() => {
              addScale.value = withTiming(1, { duration: 160 });
            }}
            hitSlop={6}
            className="items-center justify-center rounded-full"
            style={[
              { width: 28, height: 28, backgroundColor: colors.primary },
              addStyle,
            ]}
          >
            <Plus size={14} color={colors.ink} strokeWidth={2.5} />
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import {
  getLineUnitPrice,
  useCartStore,
} from "@/store/cart.store";
import { useMenuStore } from "@/store/menu.store";
import type { CartItem } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CartItemRowProps = {
  item: CartItem;
  index: number;
  onDeleted?: (productName: string) => void;
};

type CompactStepperProps = {
  value: number;
  onChange: (next: number) => void;
};

function CompactStepper({ value, onChange }: CompactStepperProps): React.ReactElement {
  const minusScale = useSharedValue(1);
  const plusScale = useSharedValue(1);

  const minusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: minusScale.value }],
    opacity: value <= 1 ? 0.3 : 1,
  }));
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusScale.value }],
    opacity: value >= 20 ? 0.3 : 1,
  }));

  const atMin = value <= 1;
  const atMax = value >= 20;

  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Diminuer la quantité"
        accessibilityState={{ disabled: atMin }}
        onPress={() => {
          if (atMin) return;
          void Haptics.selectionAsync();
          onChange(value - 1);
        }}
        onPressIn={() => {
          if (atMin) return;
          minusScale.value = withTiming(0.9, { duration: 120 });
        }}
        onPressOut={() => {
          minusScale.value = withTiming(1, { duration: 160 });
        }}
        hitSlop={6}
        className="bg-surface-container-high items-center justify-center rounded-full"
        style={[{ width: 36, height: 36 }, minusStyle]}
      >
        <Minus size={16} color={colors.ink} strokeWidth={2.5} />
      </AnimatedPressable>

      <View
        style={{
          minWidth: 28,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          className="text-on-surface"
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 20,
            lineHeight: 22,
            textAlign: "center",
          }}
        >
          {value}
        </Text>
      </View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Augmenter la quantité"
        accessibilityState={{ disabled: atMax }}
        onPress={() => {
          if (atMax) return;
          void Haptics.selectionAsync();
          onChange(value + 1);
        }}
        onPressIn={() => {
          if (atMax) return;
          plusScale.value = withTiming(0.9, { duration: 120 });
        }}
        onPressOut={() => {
          plusScale.value = withTiming(1, { duration: 160 });
        }}
        hitSlop={6}
        className="items-center justify-center rounded-full"
        style={[
          { width: 36, height: 36, backgroundColor: colors.primary },
          plusStyle,
        ]}
      >
        <Plus size={16} color={colors.ink} strokeWidth={2.5} />
      </AnimatedPressable>
    </View>
  );
}

function renderRightActions(
  _progress: unknown,
  _drag: unknown,
  _swipeable: SwipeableMethods,
): React.ReactElement {
  return (
    <View
      className="bg-primary items-center justify-center"
      style={{ width: 80 }}
    >
      <Trash2 size={22} color={colors.surface} strokeWidth={2.25} />
    </View>
  );
}

export default function CartItemRow({
  item,
  onDeleted,
}: CartItemRowProps): React.ReactElement | null {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getProductById = useMenuStore((s) => s.getProductById);
  const getSupplementById = useMenuStore((s) => s.getSupplementById);

  const product = getProductById(item.productId);
  const variant =
    item.variantId !== undefined
      ? product?.product_variants?.find((v) => v.id === item.variantId)
      : undefined;
  const unitPrice = getLineUnitPrice(item);
  const lineTotal = unitPrice * item.quantity;

  const supplementsLabel = useMemo(() => {
    if (item.supplements.length === 0) return null;
    return item.supplements
      .map((sid) => getSupplementById(sid)?.name)
      .filter((n): n is string => n !== undefined)
      .join(", ");
  }, [item.supplements, getSupplementById]);

  if (!product) {
    // Stale item — silently ignore. Cart store handles cleanup.
    return null;
  }

  const handleSwipeOpen = (): void => {
    const name = product.name;
    removeItem(item.id);
    if (onDeleted !== undefined) onDeleted(name);
  };

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={48}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
    >
      <View
        className="flex-row items-start"
        style={{ paddingHorizontal: 24, paddingVertical: 20, gap: 16 }}
      >
        <View
          className="bg-surface-container-highest rounded-lg overflow-hidden"
          style={{ width: 84, height: 84 }}
        >
          <Image
            source={product.image_url}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
            accessibilityIgnoresInvertColors
          />
        </View>

        <View className="flex-1">
          <Text
            numberOfLines={2}
            className="font-sans-bold text-on-surface"
            style={{ fontSize: 16, lineHeight: 20 }}
          >
            {product.name}
          </Text>

          {variant !== undefined ? (
            <Text
              className="font-sans-semibold text-primary"
              style={{ fontSize: 12, marginTop: 2 }}
            >
              · {variant.label}
            </Text>
          ) : null}

          {supplementsLabel !== null ? (
            <Text
              numberOfLines={1}
              className="font-sans text-on-surface-variant"
              style={{ fontSize: 12, marginTop: 2 }}
            >
              {supplementsLabel}
            </Text>
          ) : null}

          {item.notes !== undefined && item.notes.length > 0 ? (
            <View
              className="flex-row items-center"
              style={{ marginTop: 4, gap: 4 }}
            >
              <Pencil size={11} color={colors.inkMuted} strokeWidth={2} />
              <Text
                numberOfLines={1}
                className="font-sans text-on-surface-variant"
                style={{ fontSize: 12, fontStyle: "italic" }}
              >
                {item.notes}
              </Text>
            </View>
          ) : null}

          <View
            className="flex-row items-center justify-between"
            style={{ marginTop: 10 }}
          >
            <CompactStepper
              value={item.quantity}
              onChange={(next) => updateQuantity(item.id, next)}
            />
            <Text
              className="text-primary"
              style={{
                fontFamily: "BebasNeue_400Regular",
                fontSize: 22,
              }}
            >
              {formatPriceEUR(lineTotal)}
            </Text>
          </View>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}

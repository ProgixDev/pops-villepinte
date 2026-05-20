import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ShoppingBag } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { ROUTES } from "@/constants/routes";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Mirror of FloatingTabBar metrics so the cart pill clears the liquid-glass
// tab bar with a consistent gap. If those change, update here too.
const TAB_BAR_HEIGHT = 68;
const TAB_BAR_BOTTOM_OFFSET = 12;
const CART_BAR_GAP_ABOVE_TABS = 12;

export default function FloatingCartBar(): React.ReactElement | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.totalEUR());
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 20);
  const scale = useSharedValue(reducedMotion ? 1 : 0.95);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withTiming(1, { duration: 240 });
    translateY.value = withSpring(0, { damping: 14, stiffness: 180, mass: 0.9 });
    scale.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value * pressScale.value },
    ],
  }));

  if (items.length === 0) return null;

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const itemLabel = `${itemCount} article${itemCount > 1 ? "s" : ""}`;

  return (
    <Animated.View
      exiting={FadeOut.duration(200)}
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        bottom:
          Math.max(insets.bottom, TAB_BAR_BOTTOM_OFFSET) +
          TAB_BAR_HEIGHT +
          CART_BAR_GAP_ABOVE_TABS,
      }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`Voir le panier — ${itemLabel}, ${formatPriceEUR(total)}`}
        onPress={() => router.push(ROUTES.cart)}
        onPressIn={() => {
          pressScale.value = withTiming(0.97, { duration: 120 });
        }}
        onPressOut={() => {
          pressScale.value = withTiming(1, { duration: 160 });
        }}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 16,
            backgroundColor: "#FFCE00",
            paddingHorizontal: 20,
            paddingVertical: 14,
            shadowColor: "#111111",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 20,
            elevation: 10,
          },
          animatedStyle,
        ]}
      >
        {/* Left: bag icon + item count */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ShoppingBag size={18} color="#111111" strokeWidth={2.25} />
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 14,
              color: "#111111",
            }}
          >
            {itemLabel}
          </Text>
        </View>

        {/* Right: price + "VOIR LE PANIER" */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text
            style={{
              fontFamily: "BebasNeue_400Regular",
              fontSize: 20,
              color: "#111111",
            }}
          >
            {formatPriceEUR(total)}
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 11,
              color: "#111111",
              letterSpacing: 0.5,
            }}
          >
            VOIR LE PANIER {"\u2192"}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import IconButton from "@/components/common/IconButton";
import Toast from "@/components/common/Toast";
import CartEmpty from "@/components/cart/CartEmpty";
import CartItemRow from "@/components/cart/CartItemRow";
import CartSuggestionCard from "@/components/cart/CartSuggestionCard";
import CartTotals from "@/components/cart/CartTotals";
import { colors } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import { useMenuStore } from "@/store/menu.store";

const SUGGESTIONS_MAX = 6;

export default function CartScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.totalEUR());
  const PRODUCTS = useMenuStore((s) => s.products);
  const ADVICE = useMenuStore((s) => s.advice);

  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  const itemCount = useMemo(
    () => items.reduce((acc, i) => acc + i.quantity, 0),
    [items],
  );

  const suggestions = useMemo(() => {
    const inCart = new Set(items.map((i) => i.productId));
    const pool = ADVICE.length > 0 ? ADVICE : PRODUCTS;
    return pool.filter((p) => !inCart.has(p.id)).slice(0, SUGGESTIONS_MAX);
  }, [items, PRODUCTS, ADVICE]);

  const handleItemDeleted = (productName: string): void => {
    setToastMessage(`${productName} retiré du panier`);
    setToastVisible(true);
  };

  const handleValidate = (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/checkout");
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top + 8 }}>
        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: 24, paddingBottom: 8 }}
        >
          <IconButton
            icon={ChevronLeft}
            variant="light"
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          />
          <Text
            className="font-sans-semibold text-on-surface-variant uppercase"
            style={{ fontSize: 11, letterSpacing: 3 }}
          >
            Panier
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <CartEmpty />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 160 }}
      >
        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: 24 }}
        >
          <IconButton
            icon={ChevronLeft}
            variant="light"
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          />
          <Text
            className="font-sans-semibold text-on-surface-variant uppercase"
            style={{ fontSize: 11, letterSpacing: 3 }}
          >
            Panier
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Text
            className="text-on-surface"
            style={{
              fontFamily: "BebasNeue_400Regular",
              fontSize: 44,
              lineHeight: 48,
              letterSpacing: -1.5,
            }}
          >
            Votre commande
          </Text>
          <Text
            className="font-sans text-on-surface-variant"
            style={{ fontSize: 13, marginTop: 8 }}
          >
            {itemCount} article{itemCount > 1 ? "s" : ""} · prêt dans quelques
            minutes
          </Text>
        </View>

        <Animated.View
          layout={LinearTransition.duration(220)}
          style={{ marginTop: 24 }}
        >
          {items.map((item, idx) => (
            <View
              key={item.id}
              className={
                idx % 2 === 1 ? "bg-surface-container-low" : "bg-surface"
              }
            >
              <CartItemRow
                item={item}
                index={idx}
                onDeleted={handleItemDeleted}
              />
            </View>
          ))}
        </Animated.View>

        {suggestions.length > 0 ? (
          <View style={{ marginTop: 32 }}>
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <Text
                className="font-sans-semibold text-on-surface-variant uppercase"
                style={{ fontSize: 11, letterSpacing: 3 }}
              >
                Et pour accompagner ?
              </Text>
              <Text
                className="text-on-surface"
                style={{
                  fontFamily: "BebasNeue_400Regular",
                  fontSize: 22,
                  letterSpacing: -0.5,
                  marginTop: 4,
                }}
              >
                Notre conseil
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
            >
              {suggestions.map((p) => (
                <CartSuggestionCard key={p.id} product={p} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <CartTotals subtotal={total} />

        <View
          className="items-center"
          style={{ paddingHorizontal: 24, marginTop: 32 }}
        >
          <View
            style={{
              width: 32,
              height: 2,
              backgroundColor: colors.border,
              marginBottom: 16,
            }}
          />
          <Text
            className="font-sans-semibold text-on-surface-variant uppercase"
            style={{ fontSize: 10, letterSpacing: 3, textAlign: "center" }}
          >
            Retrait sur place · Villepinte
          </Text>
        </View>
      </ScrollView>

      {/* STICKY CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.white,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Valider la commande pour ${formatPriceEUR(total)}`}
          onPress={handleValidate}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingVertical: 16,
            shadowColor: colors.ink,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 10,
                letterSpacing: 2,
                color: "rgba(0,0,0,0.5)",
                textTransform: "uppercase",
              }}
            >
              Total
            </Text>
            <Text
              style={{
                fontFamily: "BebasNeue_400Regular",
                fontSize: 24,
                color: colors.ink,
                marginTop: 2,
              }}
            >
              {formatPriceEUR(total)}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.ink,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 14,
                letterSpacing: 2,
                color: colors.primary,
                textTransform: "uppercase",
              }}
            >
              Valider
            </Text>
          </View>
        </Pressable>
      </View>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        duration={2000}
      />
    </View>
  );
}

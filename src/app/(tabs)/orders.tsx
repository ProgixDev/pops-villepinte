import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Package, Receipt } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import FloatingCartBar from "@/components/cart/FloatingCartBar";
import Screen from "@/components/layout/Screen";
import ActiveOrderCard from "@/components/orders/ActiveOrderCard";
import OrderDetailsSheet from "@/components/orders/OrderDetailsSheet";
import OrdersEmpty from "@/components/orders/OrdersEmpty";
import PastOrderRow from "@/components/orders/PastOrderRow";
import { ROUTES } from "@/constants/routes";
import { colors, font, radius } from "@/constants/theme";
import { useCartStore } from "@/store/cart.store";
import { useOrdersStore } from "@/store/orders.store";
import { useProfileStore } from "@/store/profile.store";
import type { Order } from "@/types";

export default function OrdersScreen(): React.ReactElement {
  const router = useRouter();
  const active = useOrdersStore((s) => s.active);
  const history = useOrdersStore((s) => s.history);
  const fetchOrders = useOrdersStore((s) => s.fetchOrders);
  const addItem = useCartStore((s) => s.addItem);
  const profilePhone = useProfileStore((s) => s.profile.phone);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);

  useEffect(() => {
    void fetchOrders();
  }, []);

  const hasContent = active !== null || history.length > 0;

  const handleReorder = useCallback(
    (order: Order) => {
      void Haptics.selectionAsync();
      for (const item of order.items) {
        addItem({
          productId: item.productId,
          accompagnementId: item.accompagnementId,
          variantId: item.variantId,
          quantity: item.quantity,
          supplements: item.supplements,
          notes: item.notes,
        });
      }
      router.push(ROUTES.cart);
    },
    [addItem, router],
  );

  if (!hasContent) {
    return (
      <Screen scroll={false} floatingBottom={<FloatingCartBar />}>
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.white,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Receipt size={16} color={colors.primary} strokeWidth={2.5} />
            <Text
              style={{
                fontFamily: font.bodySemi,
                fontSize: 13,
                color: colors.primary,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Suivi & historique
            </Text>
          </View>
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 48,
              lineHeight: 50,
              color: colors.ink,
              letterSpacing: 1,
            }}
          >
            MES COMMANDES
          </Text>
        </View>

        {/* Empty state */}
        <OrdersEmpty />
      </Screen>
    );
  }

  return (
    <Screen floatingBottom={<FloatingCartBar />}>
      {/* Header */}
      <View
        style={{
          backgroundColor: colors.white,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Receipt size={16} color={colors.primary} strokeWidth={2.5} />
          <Text
            style={{
              fontFamily: font.bodySemi,
              fontSize: 13,
              color: colors.primary,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Suivi & historique
          </Text>
        </View>
        <Text
          style={{
            fontFamily: font.display,
            fontSize: 48,
            lineHeight: 50,
            color: colors.ink,
            letterSpacing: 1,
          }}
        >
          MES COMMANDES
        </Text>
      </View>

      {/* Active order */}
      {active !== null ? (
        <View style={{ marginTop: 20 }}>
          <View
            style={{
              paddingHorizontal: 20,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.success,
              }}
            />
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 13,
                color: colors.success,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              En cours
            </Text>
          </View>
          <ActiveOrderCard order={active} />
        </View>
      ) : null}

      {/* Past orders */}
      {history.length > 0 ? (
        <View style={{ marginTop: 32 }}>
          <View
            style={{
              paddingHorizontal: 20,
              marginBottom: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Package size={16} color={colors.inkMuted} strokeWidth={2} />
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 22,
                  color: colors.ink,
                  letterSpacing: 0.5,
                }}
              >
                HISTORIQUE
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.ink,
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: font.bodyBold,
                  fontSize: 12,
                  color: colors.white,
                }}
              >
                {history.length}
              </Text>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            {history.map((order) => (
              <PastOrderRow
                key={order.id}
                order={order}
                onReorder={() => handleReorder(order)}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setDetailsOrder(order);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Footer */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 20,
          marginTop: 32,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            width: 40,
            height: 3,
            backgroundColor: colors.primary,
            marginBottom: 12,
            borderRadius: 2,
          }}
        />
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 11,
            letterSpacing: 2,
            textAlign: "center",
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          Pop's Villepinte - Fait maison
        </Text>
      </View>

      <OrderDetailsSheet
        order={detailsOrder}
        visible={detailsOrder !== null}
        onClose={() => setDetailsOrder(null)}
        onReorder={(o) => {
          setDetailsOrder(null);
          handleReorder(o);
        }}
        customerPhone={profilePhone}
      />
    </Screen>
  );
}

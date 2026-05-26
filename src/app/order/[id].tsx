import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import IconButton from "@/components/common/IconButton";
import Toast from "@/components/common/Toast";
import CountdownRing from "@/components/order/CountdownRing";
import LiveDriverMap from "@/components/order/LiveDriverMap";
import OrderStatusPill from "@/components/order/OrderStatusPill";
import OrderTimeline from "@/components/order/OrderTimeline";
import PickupInstructions from "@/components/order/PickupInstructions";
import SuccessOverlay from "@/components/order/SuccessOverlay";
import {
  isTerminalOrderStatus,
  ORDER_STATUS,
} from "@/constants/orderStatus";
import { ROUTES } from "@/constants/routes";
import { colors } from "@/constants/theme";
import { useCountdown } from "@/hooks/useCountdown";
import { useOrdersStore } from "@/store/orders.store";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);


export default function OrderDetailScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const order = useOrdersStore((s) => {
    if (s.active?.id === id) return s.active;
    return s.history.find((o) => o.id === id) ?? null;
  });
  const refreshActive = useOrdersStore((s) => s.refreshActive);
  const fetchOrderById = useOrdersStore((s) => s.fetchOrderById);
  const confirmPickedUp = useOrdersStore((s) => s.confirmPickedUp);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const countdown = useCountdown(
    order?.createdAt ?? new Date().toISOString(),
    order?.estimatedReadyAt ?? new Date().toISOString(),
  );

  const ctaScale = useSharedValue(1);
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  // Poll for status updates from the server
  useEffect(() => {
    if (!order || isTerminalOrderStatus(order.status)) return;

    // Initial fetch
    void fetchOrderById(id);

    const poll = setInterval(() => {
      void refreshActive();
    }, 5000);

    return () => clearInterval(poll);
  }, [order?.status, id, refreshActive, fetchOrderById]);

  const isDelivery = order?.pickupMode === "delivery";

  const handleEnRoute = useCallback(() => {
    void Haptics.selectionAsync();
    setToastMessage(isDelivery ? "On l'apporte !" : "On t'attend !");
    setToastVisible(true);
  }, [isDelivery]);

  const handlePickedUp = useCallback(async () => {
    if (!order) return;
    if (confirming) return;
    setConfirming(true);
    try {
      await confirmPickedUp(order.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setToastMessage(
        e instanceof Error ? e.message : "Confirmation impossible",
      );
      setToastVisible(true);
    } finally {
      setConfirming(false);
    }
  }, [order, confirming, confirmPickedUp]);

  const handleSuccessFinish = useCallback(() => {
    if (!order) return;
    setShowSuccess(false);
    router.replace(ROUTES.orders);
  }, [order, router]);

  if (!order) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text
          className="text-on-surface"
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 28,
            letterSpacing: -1,
          }}
        >
          Commande introuvable
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 24 }}>
          <Text className="font-sans-semibold text-primary" style={{ fontSize: 14 }}>
            Retour
          </Text>
        </Pressable>
      </View>
    );
  }

  const isPreparing = order.status === ORDER_STATUS.PREPARING;
  const isReady = order.status === ORDER_STATUS.READY;
  const isHandedToLivreur = order.status === ORDER_STATUS.HANDED_TO_LIVREUR;
  const isTerminal = isTerminalOrderStatus(order.status);

  // CTA visibility:
  //  pickup orders: "Je suis en route" while preparing, "J'ai récupéré" when ready
  //  delivery orders: "Je suis là" while in transit, "J'ai récupéré" once the
  //                   livreur has handed off the bag
  const showPickupCta =
    !isDelivery && !isTerminal && (isPreparing || isReady);
  const showDeliveryCta =
    isDelivery && !isTerminal && (isPreparing || isHandedToLivreur);
  const showCta = showPickupCta || showDeliveryCta;
  const canConfirmReceipt = isDelivery ? isHandedToLivreur : isReady;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: showCta ? 160 : 80,
        }}
      >
        {/* Top bar */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: 24, marginBottom: 8 }}
        >
          <IconButton
            icon={ArrowLeft}
            variant="light"
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          />
          <OrderStatusPill status={order.status} />
          <View style={{ width: 44 }} />
        </View>

        {/* Editorial header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <Text
            className="font-sans-semibold text-on-surface-variant uppercase"
            style={{ fontSize: 11, letterSpacing: 3 }}
          >
            Commande
          </Text>
          <Text
            className="text-on-surface"
            style={{
              fontFamily: "BebasNeue_400Regular",
              fontSize: 32,
              lineHeight: 36,
              letterSpacing: -1,
              marginTop: 4,
            }}
          >
            {order.id}
          </Text>
        </View>

        {/* Countdown ring hero */}
        <View style={{ alignItems: "center", marginTop: 40, marginBottom: 40 }}>
          <CountdownRing
            progress={countdown.progress}
            minutes={countdown.minutes}
            seconds={countdown.seconds}
            status={order.status}
          />
        </View>

        {/* Live driver map — only while the assignment is "handed_to_livreur"
            (driver picked up the food and is en route to the customer).
            Earlier statuses are noise; later statuses revoke the RLS SELECT
            anyway. */}
        {isHandedToLivreur &&
        order.activeDriverId &&
        order.deliveryLat != null &&
        order.deliveryLng != null ? (
          <LiveDriverMap
            driverId={order.activeDriverId}
            dropoffCoords={[order.deliveryLng, order.deliveryLat]}
          />
        ) : null}

        {/* Timeline */}
        <OrderTimeline status={order.status} pickupMode={order.pickupMode} />

        {/* Pickup instructions */}
        <View style={{ marginTop: 8 }}>
          <PickupInstructions orderId={order.id} />
        </View>

        {/* Editorial tombstone */}
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
            POP&apos;S Villepinte · Fait maison
          </Text>
        </View>
      </ScrollView>

      {/* STICKY CTA */}
      {showCta ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            backgroundColor: colors.surface,
          }}
        >
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel={
              canConfirmReceipt
                ? "Confirmer la récupération"
                : isDelivery
                  ? "Signaler que vous êtes prêt à recevoir"
                  : "Signaler que vous êtes en route"
            }
            onPress={canConfirmReceipt ? handlePickedUp : handleEnRoute}
            disabled={confirming}
            onPressIn={() => {
              ctaScale.value = withTiming(0.98, { duration: 120 });
            }}
            onPressOut={() => {
              ctaScale.value = withTiming(1, { duration: 160 });
            }}
            className="rounded-full items-center justify-center"
            style={[
              {
                paddingHorizontal: 24,
                paddingVertical: 18,
                backgroundColor: canConfirmReceipt
                  ? colors.success
                  : colors.border,
                ...(canConfirmReceipt
                  ? {
                      shadowColor: colors.success,
                      shadowOffset: { width: 0, height: 12 },
                      shadowOpacity: 0.2,
                      shadowRadius: 24,
                      elevation: 8,
                    }
                  : {}),
                opacity: confirming ? 0.7 : 1,
              },
              ctaStyle,
            ]}
          >
            <Text
              className="uppercase"
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 13,
                letterSpacing: 2,
                color: canConfirmReceipt ? colors.surface : colors.ink,
                textAlign: "center",
              }}
            >
              {confirming
                ? "Confirmation…"
                : canConfirmReceipt
                  ? "J'ai récupéré ma commande"
                  : isDelivery
                    ? "Je suis prêt à recevoir"
                    : "Je suis en route"}
            </Text>
          </AnimatedPressable>
        </View>
      ) : null}

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        duration={2000}
      />

      <SuccessOverlay
        visible={showSuccess}
        onFinish={handleSuccessFinish}
        customerName={order.customerName}
      />
    </View>
  );
}

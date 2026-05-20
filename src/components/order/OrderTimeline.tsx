import { Text, View } from "react-native";

import { colors } from "@/constants/theme";
import type { OrderStatus } from "@/types";

type Step = {
  key: OrderStatus;
  label: string;
  activeSubtitle?: string;
};

const PICKUP_STEPS: Step[] = [
  { key: "received", label: "Commande reçue", activeSubtitle: "Votre commande est enregistrée." },
  { key: "preparing", label: "En préparation", activeSubtitle: "Votre commande est en cours…" },
  { key: "ready", label: "Prête à retirer", activeSubtitle: "Direction le comptoir !" },
  { key: "picked_up", label: "Récupérée", activeSubtitle: "Bon appétit !" },
];

const DELIVERY_STEPS: Step[] = [
  { key: "received", label: "Commande reçue", activeSubtitle: "Votre commande est enregistrée." },
  { key: "preparing", label: "En préparation", activeSubtitle: "Votre commande est en cours…" },
  { key: "ready", label: "Prête à partir", activeSubtitle: "Le livreur va prendre le sac." },
  { key: "handed_to_livreur", label: "Avec le livreur", activeSubtitle: "Il est en route vers toi." },
  { key: "picked_up", label: "Livrée", activeSubtitle: "Bon appétit !" },
];

export type OrderTimelineProps = {
  status: OrderStatus;
  pickupMode?: "pickup" | "delivery";
};

export default function OrderTimeline({
  status,
  pickupMode = "pickup",
}: OrderTimelineProps): React.ReactElement {
  const STEPS = pickupMode === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const ORDER = STEPS.map((s) => s.key);
  const current = ORDER.indexOf(status);
  const isCancelled = status === "cancelled";

  return (
    <View style={{ paddingHorizontal: 24, paddingVertical: 28 }}>
      <Text
        className="font-sans-bold text-on-surface-variant uppercase"
        style={{ fontSize: 10, letterSpacing: 2, marginBottom: 20 }}
      >
        Suivi
      </Text>

      {STEPS.map((step, idx) => {
        const isCompleted = !isCancelled && current > idx;
        const isActive = !isCancelled && current === idx;
        const isFuture = isCancelled || current < idx;
        const isLast = idx === STEPS.length - 1;

        const dotColor = isCancelled
          ? colors.error
          : isCompleted || isActive
            ? colors.primary
            : colors.border;

        const lineColor =
          isCompleted && !isCancelled
            ? colors.primary
            : colors.border;

        return (
          <View key={step.key} className="flex-row" style={{ minHeight: isLast ? 36 : 56 }}>
            {/* Dot column */}
            <View style={{ width: 24, alignItems: "center" }}>
              {isActive && !isCancelled ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `${colors.primary}26`,
                  }}
                >
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: dotColor,
                    }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: dotColor,
                    marginTop: 6,
                  }}
                />
              )}

              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    marginTop: 4,
                    backgroundColor: lineColor,
                  }}
                />
              ) : null}
            </View>

            {/* Label column */}
            <View style={{ flex: 1, paddingLeft: 16, paddingBottom: 8 }}>
              <Text
                className={`font-sans-semibold ${
                  isFuture ? "text-on-surface-variant" : "text-on-surface"
                }`}
                style={{ fontSize: 14, lineHeight: 20 }}
              >
                {step.label}
              </Text>
              {isActive && step.activeSubtitle !== undefined ? (
                <Text
                  className="font-sans text-on-surface-variant"
                  style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }}
                >
                  {step.activeSubtitle}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

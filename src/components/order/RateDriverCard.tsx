import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Star } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, shadow } from "@/constants/theme";
import { ordersApi } from "@/lib/api";

/**
 * Post-delivery prompt for the customer to rate the driver (1..5 stars +
 * optional feedback). Collapses to a thank-you recap once submitted.
 */
export default function RateDriverCard({
  orderId,
  initialStars,
  initialFeedback,
}: {
  orderId: string;
  initialStars?: number | null;
  initialFeedback?: string | null;
}): React.ReactElement {
  const [stars, setStars] = useState(initialStars ?? 0);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState((initialStars ?? 0) > 0);

  const submit = async (): Promise<void> => {
    if (stars < 1 || busy) return;
    try {
      setBusy(true);
      await ordersApi.rate(orderId, {
        stars,
        feedback: feedback.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch {
      // Keep the card interactive so the customer can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        {
          marginHorizontal: 24,
          marginTop: 8,
          padding: 20,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        shadow.card,
      ]}
    >
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 10,
          letterSpacing: 2,
          color: colors.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {done ? "Merci pour ta note" : "Note ton livreur"}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14, alignSelf: "center" }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= stars;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} étoile${n > 1 ? "s" : ""}`}
              disabled={done}
              onPress={() => {
                void Haptics.selectionAsync();
                setStars(n);
              }}
              hitSlop={6}
            >
              <Star
                size={36}
                color={on ? colors.primary : colors.border}
                fill={on ? colors.primary : "transparent"}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </View>

      {!done ? (
        <>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Un mot pour le livreur ? (optionnel)"
            placeholderTextColor={colors.inkMuted}
            multiline
            maxLength={1000}
            style={{
              marginTop: 16,
              minHeight: 64,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              fontFamily: "Poppins_400Regular",
              fontSize: 14,
              color: colors.ink,
              textAlignVertical: "top",
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer ma note"
            onPress={() => void submit()}
            disabled={stars < 1 || busy}
            style={({ pressed }) => ({
              marginTop: 14,
              backgroundColor: stars < 1 ? colors.border : colors.ink,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || busy ? 0.85 : 1,
            })}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text
                style={{
                  fontFamily: "Poppins_700Bold",
                  fontSize: 13,
                  letterSpacing: 1,
                  color: stars < 1 ? colors.inkMuted : colors.primary,
                  textTransform: "uppercase",
                }}
              >
                Envoyer ma note
              </Text>
            )}
          </Pressable>
        </>
      ) : (
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 13,
            color: colors.inkMuted,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Ton avis aide nos livreurs à s&apos;améliorer. À bientôt&nbsp;!
        </Text>
      )}
    </View>
  );
}

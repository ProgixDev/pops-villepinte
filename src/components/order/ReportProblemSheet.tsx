import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, shadow } from "@/constants/theme";
import { ordersApi } from "@/lib/api";

const CATEGORIES = [
  "Commande incomplète",
  "Article incorrect",
  "Livreur injoignable",
  "Retard important",
  "Autre",
];

export default function ReportProblemSheet({
  visible,
  orderId,
  onClose,
}: {
  visible: boolean;
  orderId: string;
  onClose: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (): Promise<void> => {
    if (!category || busy) return;
    try {
      setBusy(true);
      await ordersApi.report(orderId, {
        category,
        description: description.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      // keep open for retry
    } finally {
      setBusy(false);
    }
  };

  const close = (): void => {
    setCategory(null);
    setDescription("");
    setSent(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: insets.bottom + 20,
            },
            shadow.float,
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text
              style={{
                fontFamily: "BebasNeue_400Regular",
                fontSize: 28,
                letterSpacing: -0.5,
                color: colors.ink,
              }}
            >
              {sent ? "MERCI" : "SIGNALER UN PROBLÈME"}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={close} hitSlop={12}>
              <X size={24} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          {sent ? (
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                fontSize: 14,
                lineHeight: 22,
                color: colors.inkMuted,
                marginBottom: 8,
              }}
            >
              On a bien reçu ton signalement. L&apos;équipe POP&apos;S te recontacte
              si besoin.
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((c) => {
                  const on = category === c;
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      onPress={() => setCategory(c)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: on ? colors.ink : colors.border,
                        backgroundColor: on ? colors.ink : colors.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Poppins_600SemiBold",
                          fontSize: 13,
                          color: on ? colors.primary : colors.ink,
                        }}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Décris le problème… (optionnel)"
                placeholderTextColor={colors.inkMuted}
                multiline
                maxLength={1000}
                style={{
                  marginTop: 16,
                  minHeight: 90,
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
                accessibilityLabel="Envoyer le signalement"
                onPress={() => void submit()}
                disabled={!category || busy}
                style={({ pressed }) => ({
                  marginTop: 16,
                  backgroundColor: !category ? colors.border : colors.accent,
                  borderRadius: 16,
                  paddingVertical: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed || busy ? 0.85 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text
                    style={{
                      fontFamily: "Poppins_700Bold",
                      fontSize: 14,
                      letterSpacing: 1,
                      color: !category ? colors.inkMuted : colors.surface,
                      textTransform: "uppercase",
                    }}
                  >
                    Envoyer
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

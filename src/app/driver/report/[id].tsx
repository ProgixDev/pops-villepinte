import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, shadow } from "@/constants/theme";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";

const CATEGORIES = [
  "Client absent",
  "Adresse incorrecte",
  "Client a refusé",
  "QR illisible",
  "Autre",
];

export default function DriverReportScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reportProblem = useDeliveriesStore((s) => s.reportProblem);

  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!id || !category || busy) return;
    try {
      setBusy(true);
      await reportProblem(id, { category, description });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      Alert.alert(
        "Problème signalé",
        "Le restaurant a été prévenu. La course reste non livrée.",
        [{ text: "OK", onPress: () => router.replace("/driver" as never) }],
      );
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 28,
            letterSpacing: 1,
            color: colors.ink,
          }}
        >
          SIGNALER UN PROBLÈME
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View>
          <Label>Type de problème</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  onPress={() => setCategory(c)}
                  style={{
                    paddingHorizontal: 16,
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
        </View>

        <View>
          <Label>Détails (optionnel)</Label>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Décris ce qu'il s'est passé…"
            placeholderTextColor={colors.inkMuted}
            multiline
            maxLength={1000}
            style={{
              marginTop: 10,
              minHeight: 120,
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              fontFamily: "Poppins_400Regular",
              fontSize: 14,
              color: colors.ink,
              textAlignVertical: "top",
            }}
          />
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer le signalement"
          onPress={() => void submit()}
          disabled={!category || busy}
          style={({ pressed }) => [
            {
              backgroundColor: !category ? colors.border : colors.accent,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed || busy ? 0.85 : 1,
            },
            shadow.card,
          ]}
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
              Envoyer le signalement
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: "Poppins_700Bold",
        fontSize: 10,
        letterSpacing: 2,
        color: colors.inkMuted,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

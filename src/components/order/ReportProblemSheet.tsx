import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImagePlus, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { colors, shadow } from "@/constants/theme";
import { ordersApi } from "@/lib/api";
import { uploadTicketImages } from "@/lib/uploads";

const CATEGORIES = [
  "Commande incomplète",
  "Article incorrect",
  "Livreur injoignable",
  "Retard important",
  "Autre",
];

const MAX_IMAGES = 5;

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
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImages = async (): Promise<void> => {
    if (busy || images.length >= MAX_IMAGES) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled) return;
    setImages((prev) => [...prev, ...result.assets].slice(0, MAX_IMAGES));
  };

  const removeImage = (uri: string): void => {
    setImages((prev) => prev.filter((a) => a.uri !== uri));
  };

  const submit = async (): Promise<void> => {
    if (!category || busy) return;
    try {
      setBusy(true);
      setError(null);
      const imageUrls =
        images.length > 0 ? await uploadTicketImages(images) : undefined;
      await ordersApi.report(orderId, {
        category,
        description: description.trim() || undefined,
        imageUrls,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Envoi impossible — vérifie ta connexion et réessaie.",
      );
    } finally {
      setBusy(false);
    }
  };

  const close = (): void => {
    setCategory(null);
    setDescription("");
    setImages([]);
    setSent(false);
    setError(null);
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

              {/* Photo attachments */}
              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 13,
                    color: colors.ink,
                  }}
                >
                  Photos {images.length > 0 ? `(${images.length}/${MAX_IMAGES})` : "(optionnel)"}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10 }}
                contentContainerStyle={{ gap: 10 }}
              >
                {images.map((asset) => (
                  <View key={asset.uri} style={{ position: "relative" }}>
                    <Image
                      source={{ uri: asset.uri }}
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 14,
                        backgroundColor: colors.background,
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retirer la photo"
                      onPress={() => removeImage(asset.uri)}
                      hitSlop={8}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: colors.ink,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X size={14} color={colors.surface} strokeWidth={3} />
                    </Pressable>
                  </View>
                ))}

                {images.length < MAX_IMAGES ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter des photos"
                    onPress={() => void pickImages()}
                    disabled={busy}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderStyle: "dashed",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.background,
                    }}
                  >
                    <ImagePlus size={24} color={colors.inkMuted} strokeWidth={2} />
                  </Pressable>
                ) : null}
              </ScrollView>

              {error ? (
                <Text
                  style={{
                    marginTop: 12,
                    fontFamily: "Poppins_500Medium",
                    fontSize: 12,
                    color: "#dc2626",
                  }}
                >
                  {error}
                </Text>
              ) : null}

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

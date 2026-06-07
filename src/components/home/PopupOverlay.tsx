import { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow } from "@/constants/theme";
import type { Popup } from "@/lib/api";
import { usePopupsStore } from "@/store/popups.store";
import { useProfileStore } from "@/store/profile.store";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = Math.min(SCREEN_W - 48, 420);
const CARD_H = SCREEN_H * 0.72;

/**
 * Opening posters. On the home screen we fetch the pop-ups targeted at the
 * client's loyalty tier and present each one not-yet-seen-today, one at a time.
 * Tapping the X marks the current poster seen (for the day) and reveals the
 * next. Image-only — tapping the poster itself does nothing.
 */
export default function PopupOverlay(): React.ReactElement | null {
  const tier = useProfileStore((s) => s.profile.loyaltyTier);
  const popups = usePopupsStore((s) => s.popups);
  const fetchPopups = usePopupsStore((s) => s.fetch);
  const markSeen = usePopupsStore((s) => s.markSeen);
  const eligible = usePopupsStore((s) => s.eligible);

  // The queue is captured once (when posters first arrive) so that marking the
  // current one seen doesn't reshuffle the list mid-session.
  const [queue, setQueue] = useState<Popup[] | null>(null);
  const [index, setIndex] = useState(0);

  // Refetch whenever the tier changes (e.g. profile loads after a cold start).
  useEffect(() => {
    void fetchPopups(tier);
  }, [tier, fetchPopups]);

  useEffect(() => {
    if (queue !== null || popups.length === 0) return;
    const elig = eligible();
    if (elig.length > 0) {
      setQueue(elig);
      setIndex(0);
    }
  }, [popups, queue, eligible]);

  const current = queue && index < queue.length ? queue[index] : null;

  const dismiss = (): void => {
    if (current) markSeen(current.id);
    void Haptics.selectionAsync().catch(() => {});
    setIndex((i) => i + 1);
  };

  if (!current) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow.float]}>
          <Image
            source={{ uri: current.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            accessibilityLabel={current.title || "Pop-up"}
          />
          <Pressable
            onPress={dismiss}
            hitSlop={12}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <X size={20} color={colors.ink} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: CARD_W,
    maxHeight: CARD_H,
    aspectRatio: 0.7,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  close: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
});

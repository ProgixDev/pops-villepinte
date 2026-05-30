import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LifeBuoy, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, shadow } from "@/constants/theme";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";
import { useEarningsStore } from "@/store/driver/earnings.store";

export default function DriverScanScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const markDelivered = useDeliveriesStore((s) => s.markDelivered);
  const refreshEarnings = useEarningsStore((s) => s.fetchAll);

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One-shot guard: the camera fires onBarcodeScanned many times per second.
  const handledRef = useRef(false);

  const goHome = useCallback(() => {
    router.replace("/driver" as never);
  }, [router]);

  const complete = useCallback(
    async (payload: { method: "qr" | "manual"; code?: string }) => {
      if (!id || busy) return;
      try {
        setBusy(true);
        setError(null);
        await markDelivered(id, payload);
        void refreshEarnings();
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        goHome();
      } catch (e) {
        // Allow another scan attempt (e.g. wrong QR).
        handledRef.current = false;
        setError(e instanceof Error ? e.message : "Erreur réseau");
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
      } finally {
        setBusy(false);
      }
    },
    [id, busy, markDelivered, refreshEarnings, goHome],
  );

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (handledRef.current || busy) return;
      handledRef.current = true;
      void complete({ method: "qr", code: data });
    },
    [busy, complete],
  );

  const onManual = useCallback(() => {
    Alert.alert(
      "Confirmer sans QR ?",
      "À utiliser uniquement si le QR du client est illisible. La livraison sera marquée comme confirmée manuellement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: () => void complete({ method: "manual" }),
        },
      ],
    );
  }, [complete]);

  // ── Permission states ──
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.surface} />
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 32, gap: 16 }]}>
        <Text style={styles.permTitle}>Caméra requise</Text>
        <Text style={styles.permBody}>
          On a besoin de la caméra pour scanner le QR de livraison du client.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            permission.canAskAgain
              ? void requestPermission()
              : void Linking.openSettings()
          }
          style={styles.permBtn}
        >
          <Text style={styles.permBtnText}>
            {permission.canAskAgain ? "Autoriser la caméra" : "Ouvrir les réglages"}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.dim}>Annuler</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      />

      {/* Scan frame + instruction */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheetAbsoluteFill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={styles.frame} />
        <Text style={styles.scanHint}>
          {busy ? "Validation…" : "Scanne le QR affiché par le client"}
        </Text>
        {error ? <Text style={styles.scanError}>{error}</Text> : null}
      </View>

      {busy ? (
        <View style={[StyleSheetAbsoluteFill, styles.center, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
          <ActivityIndicator color={colors.surface} size="large" />
        </View>
      ) : null}

      {/* Close */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        onPress={() => router.back()}
        style={[
          {
            position: "absolute",
            top: insets.top + 12,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          },
          shadow.float,
        ]}
      >
        <X size={20} color={colors.ink} strokeWidth={2.5} />
      </Pressable>

      {/* Fallback actions */}
      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + 16,
          gap: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onManual}
          disabled={busy}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Confirmer sans QR</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/driver/report/${id}` as never)}
          style={styles.ghost}
        >
          <LifeBuoy size={16} color={colors.surface} strokeWidth={2.5} />
          <Text style={styles.ghostText}>Signaler un problème</Text>
        </Pressable>
      </View>
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const styles = {
  center: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: "transparent",
  },
  scanHint: {
    marginTop: 24,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: colors.surface,
    textAlign: "center" as const,
    paddingHorizontal: 32,
  },
  scanError: {
    marginTop: 10,
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: colors.primary,
    textAlign: "center" as const,
    paddingHorizontal: 32,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  secondaryText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    color: colors.ink,
    textTransform: "uppercase" as const,
  },
  ghost: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 12,
  },
  ghostText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: colors.surface,
  },
  permTitle: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 40,
    letterSpacing: -1,
    color: colors.surface,
    textAlign: "center" as const,
  },
  permBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center" as const,
  },
  permBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  permBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    letterSpacing: 1,
    color: colors.ink,
    textTransform: "uppercase" as const,
  },
  dim: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
};

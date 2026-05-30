import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { colors, shadow } from "@/constants/theme";

/**
 * Shown on the customer's order screen while the driver is en route. The driver
 * scans this QR to confirm the handoff and complete the delivery. The encoded
 * value is the order's secret delivery_code (server-verified).
 */
export default function DriverHandoffQR({
  code,
}: {
  code: string;
}): React.ReactElement {
  return (
    <View
      style={[
        {
          marginHorizontal: 24,
          marginTop: 8,
          marginBottom: 8,
          padding: 20,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
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
        Code de remise
      </Text>
      <Text
        style={{
          fontFamily: "BebasNeue_400Regular",
          fontSize: 26,
          letterSpacing: -0.5,
          color: colors.ink,
          marginTop: 4,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        Montre ce QR au livreur
      </Text>
      <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF" }}>
        <QRCode value={code} size={184} color={colors.ink} backgroundColor="#FFFFFF" />
      </View>
      <Text
        style={{
          fontFamily: "Poppins_500Medium",
          fontSize: 12,
          color: colors.inkMuted,
          marginTop: 14,
          textAlign: "center",
        }}
      >
        Le livreur le scanne pour confirmer la livraison.
      </Text>
    </View>
  );
}

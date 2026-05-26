import { Text, View } from "react-native";
import { MapPin, Package } from "lucide-react-native";

import { colors } from "@/constants/theme";
import type { DeliveryAddress } from "@/types/driver";

export type RouteSummaryProps = {
  pickup: DeliveryAddress;
  dropoff: DeliveryAddress;
};

export default function RouteSummary({
  pickup,
  dropoff,
}: RouteSummaryProps): React.ReactElement {
  return (
    <View
      style={{
        marginHorizontal: 24,
        padding: 20,
        borderRadius: 16,
        backgroundColor: "#F5F5F5",
      }}
    >
      <Stop
        icon={<Package size={18} color={colors.ink} strokeWidth={2.5} />}
        label="Récupération"
        addr={pickup}
      />
      <View
        style={{
          marginLeft: 17,
          width: 2,
          height: 24,
          backgroundColor: colors.border,
          marginVertical: 6,
        }}
      />
      <Stop
        icon={<MapPin size={18} color={colors.accent} strokeWidth={2.5} />}
        label="Livraison"
        addr={dropoff}
      />
    </View>
  );
}

function Stop({
  icon,
  label,
  addr,
}: {
  icon: React.ReactNode;
  label: string;
  addr: DeliveryAddress;
}): React.ReactElement {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 9,
            letterSpacing: 2,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 15,
            marginTop: 2,
            color: colors.ink,
          }}
        >
          {addr.label}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 13,
            lineHeight: 18,
            marginTop: 2,
            color: colors.inkMuted,
          }}
        >
          {addr.line1}
          {addr.line2 !== undefined ? `\n${addr.line2}` : ""}
          {addr.postalCode || addr.city
            ? `\n${addr.postalCode} ${addr.city}`.trim()
            : ""}
        </Text>
        {addr.notes !== undefined ? (
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 12,
              color: colors.accent,
              marginTop: 6,
            }}
          >
            {addr.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

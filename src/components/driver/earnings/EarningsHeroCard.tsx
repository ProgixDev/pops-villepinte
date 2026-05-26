import { Text, View } from "react-native";

import { colors, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";

export type EarningsHeroCardProps = {
  amountEUR: number;
  deliveries: number;
  hoursOnline: number;
  periodLabel: string;
};

export default function EarningsHeroCard({
  amountEUR,
  deliveries,
  hoursOnline,
  periodLabel,
}: EarningsHeroCardProps): React.ReactElement {
  return (
    <View
      style={[
        {
          marginHorizontal: 24,
          padding: 28,
          borderRadius: 24,
          backgroundColor: colors.ink,
        },
        shadow.hero,
      ]}
    >
      <View
        style={{
          width: 32,
          height: 2,
          backgroundColor: colors.primary,
          marginBottom: 18,
        }}
      />

      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 10,
          letterSpacing: 2,
          color: "rgba(255,255,255,0.6)",
          textTransform: "uppercase",
        }}
      >
        {periodLabel}
      </Text>

      <Text
        style={{
          fontFamily: "BebasNeue_400Regular",
          fontSize: 72,
          letterSpacing: -3,
          color: colors.primary,
          marginTop: 4,
          lineHeight: 76,
        }}
      >
        {formatPriceEUR(amountEUR)}
      </Text>

      <View
        style={{
          flexDirection: "row",
          marginTop: 18,
          paddingTop: 18,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.1)",
          gap: 24,
        }}
      >
        <Stat label="Livraisons" value={String(deliveries)} />
        <Stat label="Heures" value={hoursOnline.toFixed(1)} />
        <Stat
          label="Moyenne"
          value={
            deliveries === 0 ? "—" : formatPriceEUR(amountEUR / deliveries)
          }
        />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 9,
          letterSpacing: 2,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 18,
          color: colors.surface,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

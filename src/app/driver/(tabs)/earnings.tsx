import { useEffect } from "react";
import { Text, View } from "react-native";

import EarningsHeroCard from "@/components/driver/earnings/EarningsHeroCard";
import SectionHeader from "@/components/home/SectionHeader";
import Screen from "@/components/layout/Screen";
import { colors } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useEarningsStore } from "@/store/driver/earnings.store";

export default function DriverEarningsScreen(): React.ReactElement {
  const today = useEarningsStore((s) => s.today);
  const week = useEarningsStore((s) => s.week);
  const month = useEarningsStore((s) => s.month);
  const hoursOnlineToday = useEarningsStore((s) => s.hoursOnlineToday);
  const fetchAll = useEarningsStore((s) => s.fetchAll);

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 11,
            letterSpacing: 3,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          Tes gains
        </Text>
        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 56,
            letterSpacing: -1.5,
            color: colors.ink,
            marginTop: 8,
            lineHeight: 60,
          }}
        >
          Cash flow
        </Text>
      </View>

      <View style={{ marginTop: 16 }}>
        <EarningsHeroCard
          amountEUR={today.amountEUR}
          deliveries={today.deliveries}
          hoursOnline={hoursOnlineToday}
          periodLabel="Aujourd'hui"
        />
      </View>

      <SectionHeader title="Cumul" />

      <View style={{ marginHorizontal: 24, gap: 12 }}>
        <SummaryRow
          label="Cette semaine"
          amount={week.amountEUR}
          count={week.deliveries}
        />
        <SummaryRow
          label="Ce mois-ci"
          amount={month.amountEUR}
          count={month.deliveries}
        />
      </View>
    </Screen>
  );
}

function SummaryRow({
  label,
  amount,
  count,
}: {
  label: string;
  amount: number;
  count: number;
}): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 20,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 10,
            letterSpacing: 2,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 13,
            color: colors.inkMuted,
            marginTop: 2,
          }}
        >
          {count} course{count > 1 ? "s" : ""}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "BebasNeue_400Regular",
          fontSize: 36,
          letterSpacing: -1,
          color: colors.ink,
        }}
      >
        {formatPriceEUR(amount)}
      </Text>
    </View>
  );
}

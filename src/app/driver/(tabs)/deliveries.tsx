import { useEffect } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";

import DeliveryCard from "@/components/driver/delivery/DeliveryCard";
import SectionHeader from "@/components/home/SectionHeader";
import Screen from "@/components/layout/Screen";
import { colors } from "@/constants/theme";
import {
  selectAssignedDeliveries,
  selectCompletedDeliveries,
  useDeliveriesStore,
} from "@/store/driver/deliveries.store";

export default function DriverDeliveriesScreen(): React.ReactElement {
  const router = useRouter();
  const assigned = useDeliveriesStore(useShallow(selectAssignedDeliveries));
  const completed = useDeliveriesStore(useShallow(selectCompletedDeliveries));
  const fetchDeliveries = useDeliveriesStore((s) => s.fetch);

  useEffect(() => {
    void fetchDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 11,
            letterSpacing: 3,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          Tableau de bord
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
          Livraisons
        </Text>
      </View>

      <SectionHeader
        title="À faire"
        subtitle={
          assigned.length === 0
            ? "Aucune course en attente."
            : `${assigned.length} course${assigned.length > 1 ? "s" : ""} disponible${assigned.length > 1 ? "s" : ""}.`
        }
      />

      {assigned.length === 0 ? (
        <EmptyState message="Quand tu seras en ligne, les courses apparaîtront ici." />
      ) : (
        assigned.map((d) => (
          <DeliveryCard
            key={d.id}
            delivery={d}
            onPress={() => router.push(`/driver/assignment/${d.id}` as never)}
          />
        ))
      )}

      <SectionHeader
        title="Historique"
        subtitle={
          completed.length === 0
            ? "Tu n'as pas encore livré de course."
            : `${completed.length} course${completed.length > 1 ? "s" : ""} terminée${completed.length > 1 ? "s" : ""}.`
        }
      />

      {completed.length === 0 ? (
        <EmptyState message="Tes livraisons effectuées s'afficheront ici." />
      ) : (
        completed.map((d) => (
          <DeliveryCard
            key={d.id}
            delivery={d}
            onPress={() => router.push(`/driver/delivery/${d.id}` as never)}
          />
        ))
      )}
    </Screen>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View
      style={{
        marginHorizontal: 24,
        padding: 32,
        borderRadius: 16,
        backgroundColor: "#F5F5F5",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Poppins_600SemiBold",
          fontSize: 14,
          color: colors.inkMuted,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </View>
  );
}

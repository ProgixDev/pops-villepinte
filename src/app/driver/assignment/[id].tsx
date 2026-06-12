import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bike, Check, ChevronLeft, LifeBuoy, X } from "lucide-react-native";

import { colors, font, radius } from "@/constants/theme";
import { driverApi, type DriverAssignment } from "@/lib/api";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";
import { useMenuStore } from "@/store/menu.store";

export default function DriverAssignmentScreen(): React.ReactElement {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [assignment, setAssignment] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [responding, setResponding] = useState<"accepted" | "refused" | null>(
    null,
  );

  // Superadmin support line (configured in the admin dashboard). Lets the
  // driver reach the superadmin directly if they're not around.
  const supportPhone = useMenuStore((s) => s.shopSettings?.support_phone);
  const callSupport = useCallback(() => {
    if (!supportPhone) return;
    Linking.openURL(`tel:${supportPhone.replace(/\s+/g, "")}`).catch(() => {});
  }, [supportPhone]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const a = await driverApi.getAssignment(id);
        if (!cancelled) {
          setAssignment(a);
          setNote(a.note ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur réseau");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const respond = useCallback(
    async (status: "accepted" | "refused") => {
      if (!id) return;
      // One delivery at a time. If the driver already has a course in flight,
      // block accepting a second one here for instant feedback — the server
      // enforces the same rule as the source of truth (see drivers-me.respond).
      if (status === "accepted") {
        const active = useDeliveriesStore.getState().activeId;
        if (active && active !== id) {
          Alert.alert(
            "Livraison déjà en cours",
            "Termine ta course actuelle avant d'en accepter une nouvelle.",
          );
          return;
        }
      }
      try {
        setResponding(status);
        const updated = await driverApi.respond(id, status, note);
        setAssignment(updated);
        if (status === "accepted") {
          // Load this course into the deliveries store, then jump straight into
          // turn-by-turn navigation to the customer.
          void useDeliveriesStore.getState().fetch();
          router.replace(`/driver/navigate/${id}` as never);
          return;
        }
        Alert.alert(
          "Course refusée",
          "Le restaurant va réassigner la commande.",
          [{ text: "OK", onPress: () => router.back() }],
        );
      } catch (e) {
        Alert.alert(
          "Erreur",
          e instanceof Error ? e.message : "Erreur réseau",
        );
      } finally {
        setResponding(null);
      }
    },
    [id, note, router],
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: 24,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 14,
            color: colors.danger,
            textAlign: "center",
          }}
        >
          {error ?? "Course introuvable"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            alignSelf: "center",
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: radius.pill,
            backgroundColor: colors.ink,
          }}
        >
          <Text style={{ color: colors.white, fontFamily: font.bodyBold }}>
            Retour
          </Text>
        </Pressable>
      </View>
    );
  }

  const order = assignment.orders;
  const isPending = assignment.status === "pending";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 56,
          paddingBottom: 12,
        }}
      >
        <Pressable
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
        <View style={{ marginLeft: 12 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Bike size={14} color={colors.primaryDark} strokeWidth={2.5} />
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 10,
                letterSpacing: 2,
                color: colors.inkMuted,
              }}
            >
              NOUVELLE COURSE
            </Text>
          </View>
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 28,
              color: colors.ink,
              letterSpacing: 1,
            }}
          >
            {order?.id ?? assignment.order_id}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <StatusPill status={assignment.status} />

        <Card>
          <Label>Client</Label>
          <Value>{order?.customer_name ?? "—"}</Value>
          {order?.customer_phone ? (
            <Value muted>{order.customer_phone}</Value>
          ) : null}
        </Card>

        <Card>
          <Label>Montant</Label>
          <Value>{order ? formatEur(Number(order.total_eur)) : "—"}</Value>
        </Card>

        <Card>
          <Label>Message du restaurant</Label>
          <Value muted>
            {assignment.note ? `« ${assignment.note} »` : "Aucun message."}
          </Value>
        </Card>

        {isPending ? (
          <Card>
            <Label>Ta réponse au restaurant</Label>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="J'arrive dans 5 min, je suis au feu rouge…"
              placeholderTextColor={colors.inkMuted}
              multiline
              maxLength={500}
              style={{
                marginTop: 8,
                minHeight: 80,
                padding: 12,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                fontFamily: font.body,
                fontSize: 14,
                color: colors.ink,
                textAlignVertical: "top",
              }}
            />
          </Card>
        ) : null}

        {supportPhone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Appeler le support"
            onPress={callSupport}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 14,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <LifeBuoy size={16} color={colors.ink} strokeWidth={2.5} />
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 13,
                letterSpacing: 1,
                color: colors.ink,
              }}
            >
              APPELER LE SUPPORT
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {isPending ? (
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            padding: 16,
            paddingBottom: 32,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <ActionButton
            label="Refuser"
            icon={<X size={16} color={colors.white} strokeWidth={2.5} />}
            color={colors.danger}
            onPress={() => respond("refused")}
            loading={responding === "refused"}
          />
          <ActionButton
            label="Accepter"
            icon={<Check size={16} color={colors.ink} strokeWidth={2.5} />}
            color={colors.primary}
            textColor={colors.ink}
            onPress={() => respond("accepted")}
            loading={responding === "accepted"}
          />
        </View>
      ) : null}
    </View>
  );
}

function StatusPill({
  status,
}: {
  status: DriverAssignment["status"];
}): React.ReactElement {
  const labels: Record<DriverAssignment["status"], string> = {
    pending: "EN ATTENTE DE TA RÉPONSE",
    accepted: "ACCEPTÉE",
    refused: "REFUSÉE",
    cancelled: "ANNULÉE PAR LE RESTAURANT",
  };
  const bg: Record<DriverAssignment["status"], string> = {
    pending: colors.primary,
    accepted: colors.success,
    refused: colors.danger,
    cancelled: colors.border,
  };
  const fg: Record<DriverAssignment["status"], string> = {
    pending: colors.ink,
    accepted: colors.white,
    refused: colors.white,
    cancelled: colors.inkMuted,
  };
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: bg[status],
      }}
    >
      <Text
        style={{
          fontFamily: font.bodyBold,
          fontSize: 10,
          letterSpacing: 2,
          color: fg[status],
        }}
      >
        {labels[status]}
      </Text>
    </View>
  );
}

function Card({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}

function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}): React.ReactElement {
  return (
    <Text
      style={[
        {
          fontFamily: font.bodyBold,
          fontSize: 10,
          letterSpacing: 2,
          color: colors.inkMuted,
          marginBottom: 4,
        },
        style,
      ]}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

function Value({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: muted === true ? font.body : font.bodySemi,
        fontSize: 15,
        color: muted === true ? colors.inkMuted : colors.ink,
      }}
    >
      {children}
    </Text>
  );
}

function ActionButton({
  label,
  icon,
  color,
  textColor = colors.white,
  onPress,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  textColor?: string;
  onPress: () => void;
  loading?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading === true}
      style={{
        flex: 1,
        height: 52,
        borderRadius: radius.pill,
        backgroundColor: color,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: loading === true ? 0.6 : 1,
      }}
    >
      {loading === true ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 13,
              letterSpacing: 1.5,
              color: textColor,
            }}
          >
            {label.toUpperCase()}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function formatEur(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Megaphone,
  Receipt,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ROUTES } from "@/constants/routes";
import { colors, font, radius } from "@/constants/theme";
import { useNotificationsStore } from "@/store/notifications.store";
import type { NotificationData } from "@/lib/api";

export default function NotificationsScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useNotificationsStore((s) => s.items);
  const loading = useNotificationsStore((s) => s.loading);
  const unread = useNotificationsStore((s) => s.unread);
  const fetch = useNotificationsStore((s) => s.fetch);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const handlePress = useCallback(
    (n: NotificationData) => {
      void Haptics.selectionAsync();
      if (n.read_at === null) void markRead(n.id);
      if (n.kind === "order" && n.order_id) {
        router.push(ROUTES.orderDetail(n.order_id));
      }
    },
    [markRead, router],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.white,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <Bell size={16} color={colors.primary} strokeWidth={2.5} />
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 12,
              letterSpacing: 2,
              color: colors.ink,
              textTransform: "uppercase",
            }}
          >
            Notifications
            {unread > 0 ? ` · ${unread}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (unread === 0) return;
            void Haptics.selectionAsync();
            void markAllRead();
          }}
          disabled={unread === 0}
          accessibilityLabel="Tout marquer comme lu"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
            opacity: unread === 0 ? 0.4 : 1,
          }}
        >
          <CheckCheck size={18} color={colors.ink} strokeWidth={2.25} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{
          paddingTop: 14,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void fetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 80, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <EmptyView />
          )
        }
        renderItem={({ item }) => (
          <NotifRow notification={item} onPress={() => handlePress(item)} />
        )}
      />
    </View>
  );
}

function NotifRow({
  notification,
  onPress,
}: {
  notification: NotificationData;
  onPress: () => void;
}): React.ReactElement {
  const isOrder = notification.kind === "order";
  const Icon = isOrder ? Receipt : Megaphone;
  const unread = notification.read_at === null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={notification.title}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginBottom: 10,
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: pressed
          ? "#F0F0EA"
          : unread
            ? "#FFFBEB"
            : "#FAFAFA",
        borderWidth: 1,
        borderColor: unread ? "#F5E7A4" : "transparent",
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: isOrder ? colors.primary : colors.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          size={18}
          color={isOrder ? colors.ink : colors.primary}
          strokeWidth={2}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          {unread ? (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.accent,
              }}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              fontFamily: font.bodyBold,
              fontSize: 14,
              color: colors.ink,
              flexShrink: 1,
            }}
          >
            {notification.title}
          </Text>
        </View>
        <Text
          numberOfLines={3}
          style={{
            fontFamily: font.body,
            fontSize: 13,
            color: colors.inkMuted,
            marginTop: 4,
            lineHeight: 18,
          }}
        >
          {notification.body}
        </Text>
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 10,
            letterSpacing: 1,
            color: colors.inkMuted,
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          {relativeTime(notification.created_at)}
          {isOrder && notification.order_id ? ` · ${notification.order_id}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyView(): React.ReactElement {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
        paddingHorizontal: 32,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "#F5F5F5",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Bell size={32} color={colors.inkMuted} strokeWidth={1.6} />
      </View>
      <Text
        style={{
          fontFamily: font.display,
          fontSize: 28,
          color: colors.ink,
          textAlign: "center",
          letterSpacing: 0.5,
        }}
      >
        TOUT EST CALME
      </Text>
      <Text
        style={{
          fontFamily: font.body,
          fontSize: 14,
          color: colors.inkMuted,
          textAlign: "center",
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        On t'enverra une notification dès qu'il y a du nouveau sur tes
        commandes ou côté offres.
      </Text>
    </View>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

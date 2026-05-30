import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useDeliveriesStore } from "@/store/driver/deliveries.store";

export default function DriverLayout(): React.ReactNode {
  const router = useRouter();

  // Realtime: subscribe to my own order_assignments rows so new courses land
  // instantly over the websocket — no 10s gap waiting on the OS push or a
  // manual refresh, and a reliable fallback when the push is delayed/missed or
  // the driver was offline when assigned. RLS scopes inbound rows to this
  // driver automatically (see migration 0018 + order_assignments_driver_select).
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      const driverId = data.user?.id;
      if (!driverId || cancelled) return;
      channel = supabase
        .channel(`assignments-${driverId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_assignments",
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            // Any change to my assignments → refresh the deliveries list so the
            // UI reflects it immediately.
            void useDeliveriesStore.getState().fetch();
            // A brand-new pending assignment → jump straight to the accept/
            // refuse sheet, same destination as tapping the push.
            if (payload.eventType === "INSERT") {
              const row = payload.new as { id: string; status: string };
              if (row.status === "pending") {
                router.push(`/driver/assignment/${row.id}` as never);
              }
            }
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="assignment/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="delivery/[id]" />
      <Stack.Screen name="navigate/[id]" />
    </Stack>
  );
}

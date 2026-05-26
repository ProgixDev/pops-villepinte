import { Tabs } from "expo-router";
import { Navigation, Package, User, Wallet } from "lucide-react-native";

import FloatingTabBar from "@/components/layout/FloatingTabBar";
import { colors } from "@/constants/theme";

export default function DriverTabLayout(): React.ReactNode {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        // Same horizontal slide as the customer tabs; direction comes from the
        // tab order declared below.
        animation: "shift",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tournée",
          tabBarIcon: ({ color }) => (
            <Navigation size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Livraisons",
          tabBarIcon: ({ color }) => (
            <Package size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Gains",
          tabBarIcon: ({ color }) => (
            <Wallet size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <User size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
    </Tabs>
  );
}

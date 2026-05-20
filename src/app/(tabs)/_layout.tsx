import { Tabs } from "expo-router";
import { Home, UtensilsCrossed, Receipt, User } from "lucide-react-native";

import FloatingTabBar from "@/components/layout/FloatingTabBar";
import { colors } from "@/constants/theme";

export default function TabLayout(): React.ReactNode {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => (
            <UtensilsCrossed size={22} color={color} strokeWidth={2.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color }) => <Receipt size={22} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}

import { useEffect } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  FileText,
  HelpCircle,
  LogOut,
  Shield,
  Wallet,
} from "lucide-react-native";

import SectionHeader from "@/components/home/SectionHeader";
import Screen from "@/components/layout/Screen";
import SettingsRow from "@/components/profile/SettingsRow";
import { colors } from "@/constants/theme";
import { useAuthStore } from "@/store/auth.store";
import { useDriverProfileStore } from "@/store/driver/profile.store";

export default function DriverProfileScreen(): React.ReactElement {
  const router = useRouter();
  const profile = useDriverProfileStore((s) => s.profile);
  const fetchProfile = useDriverProfileStore((s) => s.fetch);
  const setOnline = useDriverProfileStore((s) => s.setOnline);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    void fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmLogout = (): void => {
    Alert.alert(
      "Se déconnecter ?",
      "Tu devras te reconnecter pour reprendre une tournée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            // Flip to offline before signing out so the server stops trying
            // to push assignments to this driver. Best-effort — don't block
            // the logout on a network hiccup.
            try {
              await setOnline(false);
            } catch {
              /* noop */
            }
            await logout();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View
        style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}
      >
        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 11,
            letterSpacing: 3,
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          Profil
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
          {profile.name || "Livreur"}
        </Text>
        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 14,
            color: colors.inkMuted,
            marginTop: 4,
          }}
        >
          {profile.phone}
          {profile.vehicle ? ` · ${profile.vehicle}` : ""}
          {profile.licensePlate ? ` · ${profile.licensePlate}` : ""}
        </Text>
      </View>

      <SectionHeader title="Compte" />

      <View style={{ paddingHorizontal: 24 }}>
        <SettingsRow
          icon={Wallet}
          label="Compte bancaire"
          onPress={() => router.push("/settings/payout")}
        />
        <SettingsRow
          icon={Bell}
          label="Notifications"
          onPress={() => router.push("/settings/notifications")}
        />
        <SettingsRow
          icon={FileText}
          label="Documents"
          onPress={() => router.push("/settings/documents")}
        />
      </View>

      <SectionHeader title="Aide" />

      <View style={{ paddingHorizontal: 24 }}>
        <SettingsRow
          icon={HelpCircle}
          label="Centre d'aide"
          onPress={() => router.push("/settings/help")}
        />
        <SettingsRow
          icon={Shield}
          label="Confidentialité"
          onPress={() => router.push("/settings/privacy")}
        />
        <SettingsRow
          icon={LogOut}
          label="Se déconnecter"
          labelColor={colors.error}
          onPress={confirmLogout}
        />
      </View>
    </Screen>
  );
}

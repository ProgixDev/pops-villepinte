import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import {
  Award,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Heart,
  LogOut,
  MessageCircle,
  User,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import Screen from "@/components/layout/Screen";
import TextField from "@/components/form/TextField";
import StatsCard from "@/components/profile/StatsCard";
import SettingsRow from "@/components/profile/SettingsRow";
import { colors, font, radius, shadow } from "@/constants/theme";
import { menuApi, type ShopSettings } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useProfileStore } from "@/store/profile.store";

const PHONE_REGEX = /^0[67](\d{2}){4}$/;

function formatFrenchMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export default function ProfileScreen(): React.ReactElement {
  const profile = useProfileStore((s) => s.profile);
  const updateName = useProfileStore((s) => s.updateName);
  const setProfilePhone = useProfileStore((s) => s.setPhone);

  const [name, setName] = useState<string>(
    profile.name === "Invité" ? "" : profile.name,
  );
  const [phone, setPhone] = useState<string>(
    profile.phone
      ? formatFrenchMobile(profile.phone)
      : "",
  );
  const [saved, setSaved] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void menuApi
      .getShopSettings()
      .then((data) => {
        if (!cancelled) setShopSettings(data);
      })
      .catch(() => {
        // Silent fail — section just hides on error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName =
    profile.name === "Invité" ? "SALUT !" : profile.name.toUpperCase();

  const handlePhoneChange = (v: string): void => {
    const formatted = formatFrenchMobile(v);
    setPhone(formatted);
    setSaved(false);
    const digits = formatted.replace(/\s/g, "");
    if (digits.length === 0 || digits.length < 10) {
      setPhoneError(undefined);
      return;
    }
    if (!PHONE_REGEX.test(digits)) {
      setPhoneError("Numero invalide. Format attendu : 06 ou 07 ...");
    } else {
      setPhoneError(undefined);
    }
  };

  const handleNameChange = (v: string): void => {
    setName(v);
    setSaved(false);
  };

  const handleSave = (): void => {
    const trimmedName = name.trim();
    const phoneDigits = phone.replace(/\s/g, "");

    if (phoneDigits.length > 0 && !PHONE_REGEX.test(phoneDigits)) {
      setPhoneError("Numero invalide.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (trimmedName.length >= 2) {
      void updateName(trimmedName);
    }
    if (phoneDigits.length > 0) {
      setProfilePhone(phoneDigits);
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = (): void => {
    void Haptics.selectionAsync();
    setLogoutOpen(true);
  };

  const confirmLogout = (): void => {
    setLogoutOpen(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void logout();
  };

  return (
    <Screen>
      {/* ── HEADER ── */}
      <View
        style={{
          backgroundColor: colors.white,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <User size={16} color={colors.primary} strokeWidth={2.5} />
          <Text
            style={{
              fontFamily: font.bodySemi,
              fontSize: 13,
              color: colors.primary,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Mon profil
          </Text>
        </View>
        <Text
          style={{
            fontFamily: font.display,
            fontSize: 48,
            lineHeight: 50,
            color: colors.ink,
            letterSpacing: 1,
          }}
        >
          {displayName}
        </Text>
      </View>

      {/* ── STATS CARD ── */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            padding: 24,
            ...shadow.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: font.bodyBold,
                  fontSize: 11,
                  letterSpacing: 2,
                  color: colors.ink,
                  textTransform: "uppercase",
                  opacity: 0.6,
                }}
              >
                Commandes
              </Text>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 72,
                  lineHeight: 74,
                  color: colors.ink,
                  letterSpacing: -2,
                }}
              >
                {profile.orderCount}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.ink,
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 8,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: font.bodyBold,
                  fontSize: 11,
                  color: colors.primary,
                  letterSpacing: 1,
                }}
              >
                {profile.orderCount === 0
                  ? "BIENVENUE"
                  : profile.orderCount <= 5
                    ? "HABITUE"
                    : profile.orderCount <= 15
                      ? "VIP"
                      : "LEGENDE"}
              </Text>
            </View>
          </View>
          <View
            style={{
              width: 40,
              height: 3,
              backgroundColor: colors.ink,
              opacity: 0.2,
              marginVertical: 14,
              borderRadius: 2,
            }}
          />
          <Text
            style={{
              fontFamily: font.bodyMedium,
              fontSize: 14,
              color: colors.ink,
              opacity: 0.7,
            }}
          >
            {profile.orderCount === 0
              ? "Premier passage ? Bienvenue dans la famille Pop's."
              : profile.orderCount <= 5
                ? `Bienvenue chez nous, ${profile.name === "Invité" ? "toi" : profile.name}. On te reconnait deja.`
                : profile.orderCount <= 15
                  ? "Tu fais partie des habitues. On garde ta place au chaud."
                  : `Legende vivante. Respect, ${profile.name === "Invité" ? "toi" : profile.name}.`}
          </Text>
        </View>
      </View>

      {/* ── EDITABLE FIELDS ── */}
      <View style={{ marginTop: 32 }}>
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            style={{
              width: 4,
              height: 20,
              backgroundColor: colors.primary,
              borderRadius: 2,
            }}
          />
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 22,
              color: colors.ink,
              letterSpacing: 0.5,
            }}
          >
            INFORMATIONS
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <TextField
            label="Prenom"
            value={name}
            onChangeText={handleNameChange}
            placeholder="Comment tu t'appelles ?"
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={40}
          />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <TextField
            label="Telephone"
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="06 12 34 56 78"
            error={phoneError}
            helper="Optionnel - on t'appelle quand c'est pret."
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={14}
            autoCapitalize="none"
          />
        </View>

        {shopSettings ? (
          <>
            <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
              <ReadOnlyInfoRow
                icon={Calendar}
                label="Jours d'ouverture"
                value={shopSettings.open_days}
              />
            </View>
            <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
              <ReadOnlyInfoRow
                icon={Clock}
                label="Temps d'ouverture"
                value={shopSettings.open_hours}
              />
            </View>
          </>
        ) : null}

        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mettre a jour le profil"
            onPress={handleSave}
            style={{
              backgroundColor: saved ? colors.success : colors.ink,
              borderRadius: radius.pill,
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            {saved ? (
              <CheckCircle size={18} color={colors.white} strokeWidth={2.5} />
            ) : null}
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 14,
                letterSpacing: 2,
                color: colors.white,
                textTransform: "uppercase",
              }}
            >
              {saved ? "Enregistre !" : "Mettre a jour"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── SETTINGS ── */}
      <View style={{ marginTop: 36 }}>
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            style={{
              width: 4,
              height: 20,
              backgroundColor: colors.primary,
              borderRadius: 2,
            }}
          />
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 22,
              color: colors.ink,
              letterSpacing: 0.5,
            }}
          >
            REGLAGES
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <SettingsRow icon={Heart} label="Favoris" onPress={() => router.push("/settings/favoris")} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={Award} label="Fidelite" onPress={() => router.push("/settings/fidelite")} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={Bell} label="Notifications" onPress={() => router.push("/settings/notifications")} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={FileText} label="Conditions generales" onPress={() => router.push("/settings/conditions")} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={MessageCircle} label="Nous contacter" onPress={() => router.push("/settings/contact")} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={LogOut} label="Se déconnecter" labelColor="#E3000F" onPress={handleLogout} />
        </View>
      </View>

      {/* ── FOOTER ── */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 20,
          marginTop: 40,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            width: 40,
            height: 3,
            backgroundColor: colors.primary,
            marginBottom: 12,
            borderRadius: 2,
          }}
        />
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 11,
            letterSpacing: 2,
            textAlign: "center",
            color: colors.inkMuted,
            textTransform: "uppercase",
          }}
        >
          Pop's Villepinte - v1.0 - by Progix
        </Text>
      </View>

      {/* ── LOGOUT MODAL ── */}
      <Modal
        visible={logoutOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLogoutOpen(false)}
      >
        <Pressable
          onPress={() => setLogoutOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 28,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              backgroundColor: colors.white,
              borderRadius: radius.xl,
              paddingTop: 28,
              paddingBottom: 20,
              paddingHorizontal: 24,
              alignItems: "center",
              ...shadow.float,
            }}
          >
            {/* Icon bubble */}
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(227,0,15,0.10)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <LogOut size={28} color={colors.accent} strokeWidth={2.5} />
            </View>

            {/* Title */}
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 32,
                lineHeight: 34,
                letterSpacing: 1,
                color: colors.ink,
                textAlign: "center",
              }}
            >
              DECONNEXION
            </Text>

            {/* Body */}
            <Text
              style={{
                fontFamily: font.bodyMedium,
                fontSize: 14,
                lineHeight: 20,
                color: colors.inkMuted,
                textAlign: "center",
                marginTop: 10,
                maxWidth: 280,
              }}
            >
              Tu veux vraiment te deconnecter ? Tu pourras te reconnecter quand tu veux.
            </Text>

            {/* Divider */}
            <View
              style={{
                width: 32,
                height: 3,
                backgroundColor: colors.primary,
                borderRadius: 2,
                marginTop: 20,
                marginBottom: 24,
              }}
            />

            {/* Actions */}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignSelf: "stretch",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler"
                onPress={() => setLogoutOpen(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: "transparent",
                  borderRadius: radius.pill,
                  paddingVertical: 15,
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: colors.ink,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 13,
                    letterSpacing: 1.2,
                    color: colors.ink,
                    textTransform: "uppercase",
                  }}
                >
                  Annuler
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirmer la deconnexion"
                onPress={confirmLogout}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.accent,
                  borderRadius: radius.pill,
                  paddingVertical: 15,
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 13,
                    letterSpacing: 1.2,
                    color: colors.white,
                    textTransform: "uppercase",
                  }}
                >
                  Deconnexion
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

type ReadOnlyInfoRowProps = {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  value: string;
};

function ReadOnlyInfoRow({
  icon: Icon,
  label,
  value,
}: ReadOnlyInfoRowProps): React.ReactElement {
  return (
    <View>
      <Text
        style={{
          fontFamily: font.bodyBold,
          fontSize: 10,
          letterSpacing: 2,
          marginBottom: 8,
          color: colors.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: "#F5F5F5",
          borderRadius: 12,
          paddingHorizontal: 20,
          paddingVertical: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Icon size={18} color={colors.primary} strokeWidth={2.5} />
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 16,
            color: colors.ink,
            flexShrink: 1,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

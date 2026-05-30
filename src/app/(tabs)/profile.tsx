import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  AlertTriangle,
  Award,
  Bell,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  LogOut,
  MessageCircle,
  User,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import Screen from "@/components/layout/Screen";
import TextField from "@/components/form/TextField";
import SettingsRow from "@/components/profile/SettingsRow";
import { isGuestName } from "@/constants/profile";
import { ROUTES } from "@/constants/routes";
import { colors, font, radius, shadow } from "@/constants/theme";
import { menuApi, type ShopSettings, type DayKey } from "@/lib/api";
import { loyaltyMessage, loyaltyTier } from "@/lib/loyalty";
import { formatFrenchMobile, PHONE_REGEX } from "@/lib/phone";
import {
  DAY_KEYS,
  DAY_LABELS_LONG,
  DAY_LABELS_SHORT,
  computeOpenState,
  dayKeyFromDate,
  formatDayRange,
  normalizeHours,
} from "@/lib/shopHours";
import { useAuthStore } from "@/store/auth.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useProfileStore } from "@/store/profile.store";

export default function ProfileScreen(): React.ReactElement {
  const profile = useProfileStore((s) => s.profile);
  const updateName = useProfileStore((s) => s.updateName);
  const setProfilePhone = useProfileStore((s) => s.setPhone);

  const [name, setName] = useState<string>(
    isGuestName(profile.name) ? "" : profile.name,
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
  const [hoursOpen, setHoursOpen] = useState(false);
  // Re-render every 60s so the open/closed pill stays accurate.
  const [, setTick] = useState(0);

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

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const hoursByDay = useMemo(
    () => normalizeHours(shopSettings?.hours_by_day),
    [shopSettings?.hours_by_day],
  );
  const openState = useMemo(
    () => computeOpenState(hoursByDay),
    [hoursByDay],
  );

  const displayName = isGuestName(profile.name)
    ? "SALUT !"
    : profile.name.toUpperCase();

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
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
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
          </View>
          <NotificationsBell />
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
                {loyaltyTier(profile.orderCount)}
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
            {loyaltyMessage(
              profile.orderCount,
              isGuestName(profile.name) ? "toi" : profile.name,
            )}
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
          <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 12 }}>
            <ShopStatusPill state={openState} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir les horaires d'ouverture"
              onPress={() => {
                void Haptics.selectionAsync();
                setHoursOpen(true);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                backgroundColor: "#F7F7F4",
                borderRadius: radius.lg,
                paddingHorizontal: 16,
                paddingVertical: 14,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={18} color={colors.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: font.bodySemi,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: colors.inkMuted,
                    textTransform: "uppercase",
                  }}
                >
                  Horaires d'ouverture
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 14,
                    color: colors.ink,
                    marginTop: 2,
                  }}
                >
                  {DAY_LABELS_LONG[openState.today]} ·{" "}
                  {formatDayRange(hoursByDay[openState.today])}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.inkMuted} strokeWidth={2} />
            </Pressable>
          </View>
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
          <SettingsRow icon={Heart} label="Favoris" onPress={() => router.push(ROUTES.settings("favoris"))} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={Award} label="Fidelite" onPress={() => router.push(ROUTES.settings("fidelite"))} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={Bell} label="Notifications" onPress={() => router.push(ROUTES.settings("notifications"))} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={AlertTriangle} label="Mes signalements" onPress={() => router.push(ROUTES.settings("signalements"))} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={FileText} label="Conditions generales" onPress={() => router.push(ROUTES.settings("conditions"))} />
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginLeft: 56,
            }}
          />
          <SettingsRow icon={MessageCircle} label="Nous contacter" onPress={() => router.push(ROUTES.settings("contact"))} />
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

      {/* ── HOURS MODAL ── */}
      <HoursModal
        visible={hoursOpen}
        onClose={() => setHoursOpen(false)}
        hours={hoursByDay}
        todayKey={dayKeyFromDate(new Date())}
      />

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

type ShopStatusPillProps = {
  state: ReturnType<typeof computeOpenState>;
};

function ShopStatusPill({ state }: ShopStatusPillProps): React.ReactElement {
  const tone = state.isOpen
    ? {
        bg: "#E8F8EE",
        border: "#BFE8CC",
        dot: colors.success,
        title: "#0E7C3A",
      }
    : {
        bg: "#FDECEA",
        border: "#F7C6C1",
        dot: colors.accent,
        title: "#8B1A11",
      };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: tone.bg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: tone.border,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: tone.dot,
          }}
        />
        {state.isOpen ? (
          <View
            style={{
              position: "absolute",
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: tone.dot,
              opacity: 0.18,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: font.bodyBold,
            fontSize: 10,
            letterSpacing: 1.5,
            color: tone.title,
            textTransform: "uppercase",
          }}
        >
          {state.isOpen ? "Ouvert maintenant" : "Fermé"}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: font.bodySemi,
            fontSize: 13,
            color: colors.ink,
            marginTop: 2,
          }}
        >
          {state.hint}
        </Text>
      </View>
    </View>
  );
}

type HoursModalProps = {
  visible: boolean;
  onClose: () => void;
  hours: Record<DayKey, { closed: boolean; open: string; close: string }>;
  todayKey: DayKey;
};

function HoursModal({
  visible,
  onClose,
  hours,
  todayKey,
}: HoursModalProps): React.ReactElement {
  const [selected, setSelected] = useState<DayKey>(todayKey);
  // Re-anchor selection to today every time the sheet reopens.
  useEffect(() => {
    if (visible) setSelected(todayKey);
  }, [visible, todayKey]);

  const dayRow = hours[selected];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: 14,
            paddingBottom: 28,
            paddingHorizontal: 20,
            ...shadow.float,
          }}
        >
          {/* Grabber */}
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#E0E0E0",
              marginBottom: 16,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: font.bodyBold,
                  fontSize: 10,
                  letterSpacing: 2,
                  color: colors.inkMuted,
                  textTransform: "uppercase",
                }}
              >
                POP'S Villepinte
              </Text>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 30,
                  lineHeight: 32,
                  color: colors.ink,
                  letterSpacing: 1,
                  marginTop: 2,
                }}
              >
                HORAIRES
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Fermer"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Day chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            style={{ marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 16 }}
          >
            {DAY_KEYS.map((k) => {
              const active = k === selected;
              const isToday = k === todayKey;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelected(k);
                  }}
                  style={{
                    height: 44,
                    paddingHorizontal: 14,
                    borderRadius: 22,
                    backgroundColor: active ? colors.ink : "#F5F5F5",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.bodyBold,
                      fontSize: 12,
                      letterSpacing: 1.5,
                      color: active ? colors.primary : colors.ink,
                    }}
                  >
                    {DAY_LABELS_SHORT[k]}
                  </Text>
                  {isToday ? (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: active ? colors.primary : colors.accent,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Selected day detail */}
          <View
            style={{
              backgroundColor: dayRow.closed ? "#FDECEA" : "#FFFBEB",
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: dayRow.closed ? "#F7C6C1" : "#F5E7A4",
              paddingHorizontal: 18,
              paddingVertical: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: dayRow.closed ? colors.accent : colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock
                size={20}
                color={dayRow.closed ? colors.white : colors.ink}
                strokeWidth={2.5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: font.bodyBold,
                  fontSize: 10,
                  letterSpacing: 2,
                  color: colors.inkMuted,
                  textTransform: "uppercase",
                }}
              >
                {DAY_LABELS_LONG[selected]}
                {selected === todayKey ? " · aujourd'hui" : ""}
              </Text>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 30,
                  lineHeight: 32,
                  color: colors.ink,
                  marginTop: 4,
                }}
              >
                {formatDayRange(dayRow).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Full week list */}
          <View style={{ marginTop: 18 }}>
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 10,
                letterSpacing: 2,
                color: colors.inkMuted,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Toute la semaine
            </Text>
            {DAY_KEYS.map((k, idx) => {
              const row = hours[k];
              const isToday = k === todayKey;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelected(k);
                  }}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: "#F2F2F2",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {isToday ? (
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.accent,
                        }}
                      />
                    ) : (
                      <View style={{ width: 6 }} />
                    )}
                    <Text
                      style={{
                        fontFamily: isToday ? font.bodyBold : font.bodySemi,
                        fontSize: 14,
                        color: colors.ink,
                      }}
                    >
                      {DAY_LABELS_LONG[k]}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: font.bodySemi,
                      fontSize: 13,
                      color: row.closed ? colors.accent : colors.ink,
                    }}
                  >
                    {formatDayRange(row)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NotificationsBell(): React.ReactElement {
  const router = useRouter();
  const unread = useNotificationsStore((s) => s.unread);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0
          ? `Notifications (${unread} non lue${unread > 1 ? "s" : ""})`
          : "Notifications"
      }
      onPress={() => {
        void Haptics.selectionAsync();
        router.push(ROUTES.notifications as never);
      }}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#F5F5F5",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Bell size={20} color={colors.ink} strokeWidth={2.25} />
      {unread > 0 ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.accent,
            paddingHorizontal: 4,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#F5F5F5",
          }}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 9,
              color: colors.white,
              lineHeight: 11,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

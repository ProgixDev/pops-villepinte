import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { ArrowLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FoodPattern from "@/components/common/FoodPattern";
import { colors } from "@/constants/theme";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import {
  buildE164,
  DIAL_PREFIXES,
  formatFrenchMobile,
  type DialPrefix,
} from "@/lib/phone";
import { useAuthStore } from "@/store/auth.store";
import { useProfileStore } from "@/store/profile.store";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require("../../../assets/images/pops-logo.png") as number;

const PATTERN_HEIGHT = Dimensions.get("window").height * 0.35;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export type AuthFlowProps = {
  onComplete: (phone: string) => void;
};

export default function AuthFlow({
  onComplete,
}: AuthFlowProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const setProfilePhone = useProfileStore((s) => s.setPhone);
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const loading = useAuthStore((s) => s.loading);
  const authChoice = useAuthStore((s) => s.authChoice);
  const setAuthChoice = useAuthStore((s) => s.setAuthChoice);
  // Defer the ~250-node food pattern until after first paint.
  const patternReady = useDeferredMount();

  const isRegister = authChoice === "register";
  const phoneTitle = isRegister ? "INSCRIPTION" : "CONNEXION";
  const phoneSubtitle = isRegister
    ? "Crée ton compte en un éclair. Pas de spam, promis."
    : "Entre ton numéro pour commander. Pas de spam, promis.";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [prefixIdx, setPrefixIdx] = useState(0);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill("") as string[]);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // Tick the resend cooldown down to 0. Effect re-runs whenever the cooldown
  // is restarted (after sendCode / resend); a single interval per cycle is
  // fine since we always end at 0 and stop.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const prefix: DialPrefix = DIAL_PREFIXES[prefixIdx] ?? DIAL_PREFIXES[0]!;
  const isFrench = prefix.display === "+33";

  const cyclePrefix = (): void => {
    void Haptics.selectionAsync();
    setPrefixIdx((i) => (i + 1) % DIAL_PREFIXES.length);
    setPhone("");
    setPhoneError(undefined);
  };

  // Single ref holding an array of TextInput refs. Avoids the rules-of-hooks
  // violation of calling useRef() inside a .map/Array.from loop.
  const otpRefs = useRef<Array<TextInput | null>>(
    Array.from({ length: OTP_LENGTH }, () => null),
  );
  const setOtpRef = (i: number) => (node: TextInput | null): void => {
    otpRefs.current[i] = node;
  };

  const handlePhoneChange = (v: string): void => {
    // French gets the familiar "06 12 34 56 78" formatter; other prefixes
    // accept raw digits (up to 10) with no auto-grouping.
    if (isFrench) {
      setPhone(formatFrenchMobile(v));
    } else {
      const digits = v.replace(/\D/g, "").slice(0, prefix.maxLocalDigits);
      setPhone(digits);
    }
    setPhoneError(undefined);
  };

  const handleSendCode = async (): Promise<void> => {
    const e164 = buildE164(prefix, phone);
    if (!e164) {
      setPhoneError(
        isFrench
          ? "Numéro invalide. Utilise un 06 ou 07."
          : "Numéro invalide. Doit commencer par 5, 6 ou 7.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.selectionAsync();

    const result = await sendOtp(e164);
    if (result.error) {
      setPhoneError(result.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setStep("otp");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setTimeout(() => otpRefs.current[0]?.focus(), 300);
  };

  const handleResendCode = async (): Promise<void> => {
    if (resendCooldown > 0 || resending) return;
    const e164 = buildE164(prefix, phone);
    if (!e164) {
      setOtpError("Numéro invalide.");
      return;
    }
    setResending(true);
    setOtpError(undefined);
    void Haptics.selectionAsync();

    const result = await sendOtp(e164);
    setResending(false);
    if (result.error) {
      setOtpError(result.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setOtp(Array(OTP_LENGTH).fill(""));
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setTimeout(() => otpRefs.current[0]?.focus(), 200);
  };

  const handleOtpDigit = async (digit: string, index: number): Promise<void> => {
    if (digit.length > 1) return;
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpError(undefined);

    if (digit !== "" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }

    if (index === OTP_LENGTH - 1 && digit !== "") {
      const code = next.join("");
      const e164 = buildE164(prefix, phone);
      if (!e164) {
        setOtpError("Numéro invalide.");
        return;
      }

      const result = await verifyOtp(e164, code);
      if (result.error) {
        setOtpError(result.error);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setOtp(Array(OTP_LENGTH).fill(""));
        setTimeout(() => otpRefs.current[0]?.focus(), 200);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setProfilePhone(e164);
        onComplete(e164);
      }
    }
  };

  const handleOtpBackspace = (index: number): void => {
    if (otp[index] === "" && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
    }
  };

  // ── OTP SCREEN ──
  if (step === "otp") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.primary,
          paddingHorizontal: 32,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <Pressable
            onPress={() => { setStep("phone"); setOtp(Array(OTP_LENGTH).fill("")); setOtpError(undefined); }}
            hitSlop={16}
          >
            <ArrowLeft size={28} color={colors.ink} strokeWidth={2.5} />
          </Pressable>
          <Image
            source={logoImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey="pops-logo"
            style={{ width: 60, height: 60 }}
          />
          <View style={{ width: 28 }} />
        </View>

        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 44,
            lineHeight: 46,
            letterSpacing: 2,
            color: colors.ink,
          }}
        >
          ENTRE TON CODE
        </Text>

        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 14,
            color: "rgba(0,0,0,0.55)",
            marginTop: 8,
          }}
        >
          Code envoyé au {prefix.display} {phone}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 36,
          }}
        >
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={setOtpRef(i)}
              value={digit}
              onChangeText={(v) => void handleOtpDigit(v, i)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Backspace") handleOtpBackspace(i);
              }}
              keyboardType="number-pad"
              maxLength={1}
              style={{
                width: 50,
                height: 64,
                borderRadius: 14,
                backgroundColor: colors.ink,
                textAlign: "center",
                fontFamily: "BebasNeue_400Regular",
                fontSize: 28,
                color: colors.primary,
              }}
            />
          ))}
        </View>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.ink}
            style={{ marginTop: 16 }}
          />
        ) : otpError !== undefined ? (
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 13,
              color: colors.accent,
              marginTop: 16,
            }}
          >
            {otpError}
          </Text>
        ) : (
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "rgba(0,0,0,0.35)",
              marginTop: 16,
            }}
          >
            Code à 6 chiffres envoyé par SMS
          </Text>
        )}

        {/* Resend OTP: countdown while cooling down, tappable once it hits 0. */}
        <View style={{ marginTop: 24, alignItems: "center" }}>
          {resendCooldown > 0 ? (
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                fontSize: 13,
                color: "rgba(0,0,0,0.45)",
              }}
            >
              Renvoyer le code dans {resendCooldown}s
            </Text>
          ) : (
            <Pressable
              onPress={() => void handleResendCode()}
              disabled={resending}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Renvoyer le code"
            >
              {resending ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Text
                  style={{
                    fontFamily: "Poppins_700Bold",
                    fontSize: 14,
                    color: colors.ink,
                    textDecorationLine: "underline",
                  }}
                >
                  Renvoyer le code
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // ── PHONE SCREEN ──
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary,
        overflow: "hidden",
      }}
    >
      {/* Header: back arrow + centered logo */}
      <View
        style={{
          paddingHorizontal: 32,
          paddingTop: insets.top + 16,
          zIndex: 15,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() => setAuthChoice(null)}
          hitSlop={16}
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={28} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
        <Image
          source={logoImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey="pops-logo"
          style={{ width: 80, height: 80 }}
        />
        <View style={{ width: 28 }} />
      </View>

      {/* Form content */}
      <View
        style={{
          paddingHorizontal: 32,
          paddingTop: 24,
          zIndex: 10,
        }}
      >
        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 44,
            lineHeight: 46,
            letterSpacing: 2,
            color: colors.ink,
          }}
        >
          {phoneTitle}
        </Text>

        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 14,
            color: "rgba(0,0,0,0.55)",
            marginTop: 8,
            maxWidth: 280,
          }}
        >
          {phoneSubtitle}
        </Text>

        <View
          style={{
            backgroundColor: colors.ink,
            borderRadius: 16,
            paddingHorizontal: 20,
            paddingVertical: 18,
            marginTop: 36,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Pressable
            onPress={cyclePrefix}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Changer l'indicatif pays"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: "rgba(255,206,0,0.12)",
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 14,
                letterSpacing: 0.5,
                color: colors.primary,
              }}
            >
              {prefix.display}
            </Text>
          </Pressable>
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder={isFrench ? "06 12 34 56 78" : "5 12 34 56 78"}
            placeholderTextColor="rgba(255,206,0,0.35)"
            keyboardType="phone-pad"
            maxLength={isFrench ? 14 : prefix.maxLocalDigits}
            autoFocus
            style={{
              flex: 1,
              fontFamily: "Poppins_600SemiBold",
              fontSize: 18,
              color: colors.primary,
              paddingVertical: 0,
            }}
          />
        </View>

        {phoneError !== undefined ? (
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 13,
              color: colors.accent,
              marginTop: 12,
            }}
          >
            {phoneError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void handleSendCode()}
          disabled={loading}
          style={{
            backgroundColor: colors.ink,
            borderRadius: 999,
            paddingVertical: 18,
            alignItems: "center",
            marginTop: 28,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 14,
                letterSpacing: 1,
                color: colors.primary,
                textTransform: "uppercase",
              }}
            >
              Recevoir le code
            </Text>
          )}
        </Pressable>
      </View>

      {/* Food illustrations — dense grid pattern filling bottom 35%, deferred */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: PATTERN_HEIGHT }}
      >
        {patternReady ? <FoodPattern height={PATTERN_HEIGHT} /> : null}
      </View>

    </View>
  );
}

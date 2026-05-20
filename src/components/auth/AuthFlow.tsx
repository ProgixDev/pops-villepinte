import { useRef, useState } from "react";
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
import { formatFrenchMobile, PHONE_REGEX } from "@/lib/phone";
import { useAuthStore } from "@/store/auth.store";
import { useProfileStore } from "@/store/profile.store";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require("../../../assets/images/pops-logo.png") as number;

const PATTERN_HEIGHT = Dimensions.get("window").height * 0.35;
const OTP_LENGTH = 6;

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
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill("") as string[]);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();

  const otpRefs = Array.from({ length: OTP_LENGTH }, () =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRef<TextInput>(null),
  );

  const handlePhoneChange = (v: string): void => {
    setPhone(formatFrenchMobile(v));
    setPhoneError(undefined);
  };

  const handleSendCode = async (): Promise<void> => {
    const digits = phone.replace(/\s/g, "");
    if (!PHONE_REGEX.test(digits)) {
      setPhoneError("Numéro invalide. Utilise un 06 ou 07.");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    void Haptics.selectionAsync();

    const result = await sendOtp(digits);
    if (result.error) {
      setPhoneError(result.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setStep("otp");
    setTimeout(() => otpRefs[0].current?.focus(), 300);
  };

  const handleOtpDigit = async (digit: string, index: number): Promise<void> => {
    if (digit.length > 1) return;
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpError(undefined);

    if (digit !== "" && index < OTP_LENGTH - 1) {
      otpRefs[index + 1].current?.focus();
    }

    if (index === OTP_LENGTH - 1 && digit !== "") {
      const code = next.join("");
      const digits = phone.replace(/\s/g, "");

      const result = await verifyOtp(digits, code);
      if (result.error) {
        setOtpError(result.error);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setOtp(Array(OTP_LENGTH).fill(""));
        setTimeout(() => otpRefs[0].current?.focus(), 200);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setProfilePhone(digits);
        onComplete(digits);
      }
    }
  };

  const handleOtpBackspace = (index: number): void => {
    if (otp[index] === "" && index > 0) {
      otpRefs[index - 1].current?.focus();
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
          Code envoyé au {phone}
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
              ref={otpRefs[i]}
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
      {/* Header with back arrow */}
      <View
        style={{
          paddingHorizontal: 32,
          paddingTop: insets.top + 16,
          zIndex: 15,
        }}
      >
        <Pressable
          onPress={() => setAuthChoice(null)}
          hitSlop={16}
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={28} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
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
          <View
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
              +33
            </Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="06 12 34 56 78"
            placeholderTextColor="rgba(255,206,0,0.35)"
            keyboardType="phone-pad"
            maxLength={14}
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

      {/* Logo centered at very bottom */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          paddingBottom: 0,
          zIndex: 15,
        }}
      >
        <Image
          source={logoImage}
          contentFit="contain"
          style={{ width: 80, height: 80 }}
        />
      </View>
    </View>
  );
}

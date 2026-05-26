import { Dimensions, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FoodPattern from "@/components/common/FoodPattern";
import { colors } from "@/constants/theme";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import { useAuthStore } from "@/store/auth.store";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require("../../../assets/images/pops-logo.png") as number;

const PATTERN_HEIGHT = Dimensions.get("window").height * 0.35;

export default function AuthIndex(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const setAuthChoice = useAuthStore((s) => s.setAuthChoice);
  // Defer the ~250-node food pattern until after first paint so the auth
  // landing renders instantly instead of blocking on the image grid.
  const patternReady = useDeferredMount();

  const handleChoose = (
    choice: "signin" | "register" | "driver-signin",
  ): void => {
    void Haptics.selectionAsync();
    setAuthChoice(choice);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary,
        overflow: "hidden",
      }}
    >
      {/* Top content */}
      <View
        style={{
          paddingHorizontal: 32,
          paddingTop: insets.top + 32,
          zIndex: 10,
          alignItems: "center",
        }}
      >
        <Image
          source={logoImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey="pops-logo"
          style={{ width: 100, height: 100 }}
        />
      </View>

      {/* Headline + actions */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 32,
          paddingTop: 48,
          zIndex: 10,
        }}
      >
        <Text
          style={{
            fontFamily: "BebasNeue_400Regular",
            fontSize: 52,
            lineHeight: 54,
            letterSpacing: 2,
            color: colors.ink,
          }}
        >
          BIENVENUE{"\n"}CHEZ POP'S
        </Text>

        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 15,
            lineHeight: 22,
            color: "rgba(0,0,0,0.6)",
            marginTop: 14,
            maxWidth: 320,
          }}
        >
          Connecte-toi pour commander, ou crée un compte en 30 secondes.
        </Text>

        <View style={{ marginTop: 40, gap: 14 }}>
          <Pressable
            onPress={() => handleChoose("signin")}
            style={({ pressed }) => ({
              backgroundColor: colors.ink,
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 14,
                letterSpacing: 1,
                color: colors.primary,
                textTransform: "uppercase",
              }}
            >
              Se connecter
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleChoose("register")}
            style={({ pressed }) => ({
              backgroundColor: "transparent",
              borderRadius: 999,
              paddingVertical: 18,
              alignItems: "center",
              borderWidth: 2,
              borderColor: colors.ink,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 14,
                letterSpacing: 1,
                color: colors.ink,
                textTransform: "uppercase",
              }}
            >
              S'inscrire
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleChoose("driver-signin")}
            style={({ pressed }) => ({
              alignItems: "center",
              paddingVertical: 6,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "Poppins_500Medium",
                fontSize: 13,
                color: "rgba(0,0,0,0.6)",
                textDecorationLine: "underline",
              }}
            >
              Je suis livreur
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Food illustrations pattern — bottom 35%, deferred past first paint */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: PATTERN_HEIGHT }}
      >
        {patternReady ? <FoodPattern height={PATTERN_HEIGHT} /> : null}
      </View>

      {/* Bottom safe-area spacer */}
      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}

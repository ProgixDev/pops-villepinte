import { Dimensions, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { useAuthStore } from "@/store/auth.store";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require("../../../assets/images/pops-logo.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const burgerIll = require("../../../assets/images/burgerillustartion.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const friesIll = require("../../../assets/images/friesillustartion.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tacosIll = require("../../../assets/images/tacosillustartion.png") as number;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const ICONS = [burgerIll, friesIll, tacosIll];
const ROTATIONS = [-10, 14, -6, 18, -12, 8, -16, 10, -4, 20, -8, 12, -14, 6, -18, 16];

function buildPatternItems(): React.ReactElement[] {
  const patternHeight = SCREEN_HEIGHT * 0.35;
  const rows = Math.ceil(patternHeight / 70) + 2;
  const cols = Math.ceil(SCREEN_WIDTH / 55);
  const items: React.ReactElement[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const src = ICONS[idx % ICONS.length]!;
      const rot = ROTATIONS[idx % ROTATIONS.length]!;
      items.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            top: r * 70 + (c % 2 === 0 ? 0 : 35),
            left: c * 55 + (r % 2 === 0 ? 0 : 26),
            transform: [{ rotate: `${rot}deg` }],
            opacity: 0.6,
          }}
        >
          <Image
            source={src}
            contentFit="contain"
            style={{ width: 40, height: 40 }}
          />
        </View>,
      );
      idx++;
    }
  }
  return items;
}

const patternItems = buildPatternItems();

export default function AuthIndex(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const setAuthChoice = useAuthStore((s) => s.setAuthChoice);

  const handleChoose = (choice: "signin" | "register"): void => {
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
        </View>
      </View>

      {/* Food illustrations pattern — bottom 35% */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%" }}
      >
        {patternItems}
      </View>

      {/* Bottom safe-area spacer */}
      <View style={{ height: insets.bottom + 16 }} />
    </View>
  );
}

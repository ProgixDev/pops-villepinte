import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ShoppingBag } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ROUTES } from "@/constants/routes";
import { colors } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CartEmpty(): React.ReactElement {
  const router = useRouter();
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handleExplore = (): void => {
    router.back();
    setTimeout(() => {
      router.replace(ROUTES.menu);
    }, 0);
  };

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ paddingHorizontal: 40 }}
    >
      <View
        className="bg-surface-container items-center justify-center rounded-full"
        style={{ width: 120, height: 120 }}
      >
        <ShoppingBag
          size={56}
          color={colors.inkMuted}
          strokeWidth={1.5}
        />
      </View>

      <Text
        className="text-on-surface"
        style={{
          fontFamily: "BebasNeue_400Regular",
          fontSize: 32,
          lineHeight: 36,
          letterSpacing: -1,
          marginTop: 28,
          textAlign: "center",
        }}
      >
        Votre panier est vide.
      </Text>

      <Text
        className="font-sans text-on-surface-variant"
        style={{
          fontSize: 14,
          lineHeight: 22,
          marginTop: 10,
          maxWidth: 280,
          textAlign: "center",
        }}
      >
        Laissez-vous tenter — la carte est faite maison, chaque jour.
      </Text>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Explorer le menu"
        onPress={handleExplore}
        onPressIn={() => {
          pressScale.value = withTiming(0.97, { duration: 120 });
        }}
        onPressOut={() => {
          pressScale.value = withTiming(1, { duration: 160 });
        }}
        className="bg-primary rounded-full"
        style={[
          {
            paddingHorizontal: 32,
            paddingVertical: 16,
            marginTop: 32,
          },
          animatedStyle,
        ]}
      >
        <Text
          className="uppercase"
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 12,
            letterSpacing: 2,
            color: colors.surface,
          }}
        >
          Explorer le menu
        </Text>
      </AnimatedPressable>
    </View>
  );
}

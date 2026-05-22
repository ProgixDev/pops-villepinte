import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { ChevronRight, MapPin, ShoppingBag, UtensilsCrossed } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const burgerImage = require("../../../assets/images/burger.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tendersImage = require("../../../assets/images/tenders.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tacosImage = require("../../../assets/images/tacos.png") as number;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TAPE_TEXT = "POP'S · POP'S · POP'S · POP'S · POP'S · POP'S · POP'S · POP'S · POP'S · POP'S · ";
const TAPE_WIDTH = SCREEN_WIDTH + 80;

type WarningTapeProps = {
  top: number;
  rotate: string;
  index: number;
  direction: "left" | "right";
};

function WarningTape({ top, rotate, index, direction }: WarningTapeProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const startX = direction === "left" ? -TAPE_WIDTH : TAPE_WIDTH;
  const translateX = useSharedValue(reducedMotion ? 0 : startX);
  const textOpacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    const slideDelay = index * 100;
    translateX.value = withDelay(slideDelay, withTiming(0, { duration: 500 }));
    textOpacity.value = withDelay(slideDelay + 350, withTiming(1, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tapeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top,
          left: -40,
          right: -40,
          zIndex: 5,
          backgroundColor: "rgba(0,0,0,0.08)",
          paddingVertical: 10,
          overflow: "hidden",
        },
        tapeStyle,
      ]}
    >
      <Animated.Text
        numberOfLines={1}
        style={[
          {
            fontFamily: "BebasNeue_400Regular",
            fontSize: 16,
            letterSpacing: 6,
            color: "rgba(0,0,0,0.15)",
            textAlign: "center",
          },
          textStyle,
        ]}
      >
        {TAPE_TEXT}
      </Animated.Text>
    </Animated.View>
  );
}

type Slide = {
  id: string;
  icon: typeof UtensilsCrossed;
  title: string;
  body: string;
  bg: string;
};

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: UtensilsCrossed,
    title: "BIENVENUE\nCHEZ POP'S",
    body: "Smash burgers, tacos, bowls — fait maison à Villepinte. Du peuple, pour le peuple.",
    bg: colors.primary,
  },
  {
    id: "2",
    icon: ShoppingBag,
    title: "COMMANDE\nEN 30 SEC",
    body: "Choisis ton plat, personnalise-le avec tes suppléments, et valide. C'est tout.",
    bg: colors.primary,
  },
  {
    id: "3",
    icon: MapPin,
    title: "VIENS\nRÉCUPÉRER",
    body: "Ta commande est prête quand tu arrives. Pas de file, pas d'attente. Cash ou CB.",
    bg: colors.primary,
  },
];

export type OnboardingFlowProps = {
  onComplete: () => void;
};

export default function OnboardingFlow({
  onComplete,
}: OnboardingFlowProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0]?.index !== null) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = currentIndex === SLIDES.length - 1;

  const handleNext = (): void => {
    void Haptics.selectionAsync();
    if (isLast) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handleSkip = (): void => {
    void Haptics.selectionAsync();
    onComplete();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, overflow: "hidden" }}>
      {/* Warning tapes — top area on slides 1&2, bottom area on slide 3. The
          5 instances stay mounted across slide transitions (stable keys) so
          we don't remount + re-allocate shared values every time currentIndex
          crosses 1↔2. Only the `top` prop changes. */}
      {[0, 1, 2, 3, 4].map((i) => {
        const baseTop = currentIndex <= 1 ? 140 : 440;
        return (
          <WarningTape
            key={i}
            top={baseTop + i * 50}
            rotate="-6deg"
            index={i}
            direction={i % 2 === 0 ? "left" : "right"}
          />
        );
      })}

      {currentIndex === 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top - 40,
            right: -100,
            zIndex: 10,
            width: 380,
            height: 380,
            transform: [{ rotate: "30deg" }],
          }}
        >
          <Image
            source={burgerImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey="onboarding-burger"
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      ) : null}

      {/* Tenders image — slide 2, top center, flush to top */}
      {currentIndex === 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            alignItems: "center",
          }}
        >
          <Image
            source={tendersImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey="onboarding-tenders"
            style={{ width: 480, height: 480 }}
          />
        </View>
      ) : null}

      {/* Tacos image — slide 3, bottom flush */}
      {currentIndex === 2 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -40,
            left: 0,
            right: 0,
            zIndex: 5,
            alignItems: "center",
          }}
        >
          <Image
            source={tacosImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey="onboarding-tacos"
            style={{ width: 500, height: 500 }}
          />
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ zIndex: 10 }}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index: slideIndex }) => {
          const Icon = item.icon;
          const isSlide3 = slideIndex === 2;
          return (
            <View
              style={{
                width: SCREEN_WIDTH,
                flex: 1,
                backgroundColor: "transparent",
                paddingHorizontal: 32,
                paddingTop: isSlide3 ? insets.top + 90 : insets.top + 60,
                paddingBottom: insets.bottom + 120,
                justifyContent: isSlide3 ? "flex-start" : "flex-end",
              }}
            >
              {!isSlide3 ? (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 32,
                  }}
                >
                  <Icon
                    size={40}
                    color={colors.ink}
                    strokeWidth={2.5}
                  />
                </View>
              ) : null}

              <Text
                style={{
                  fontFamily: "BebasNeue_400Regular",
                  fontSize: 56,
                  lineHeight: 58,
                  letterSpacing: 2,
                  color: colors.ink,
                }}
              >
                {item.title}
              </Text>

              <Text
                style={{
                  fontFamily: "Poppins_500Medium",
                  fontSize: 16,
                  lineHeight: 24,
                  color: "rgba(0,0,0,0.65)",
                  marginTop: 20,
                  maxWidth: 300,
                }}
              >
                {item.body}
              </Text>
            </View>
          );
        }}
      />

      {/* Controls — bottom on slides 1&2, top on slide 3 */}
      <View
        style={{
          position: "absolute",
          ...(currentIndex === 2
            ? { top: 0, paddingTop: insets.top + 16 }
            : { bottom: 0, paddingBottom: insets.bottom + 24 }),
          left: 0,
          right: 0,
          paddingHorizontal: 32,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 20,
        }}
      >
        <Pressable onPress={handleSkip} hitSlop={16}>
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 14,
              color: "rgba(0,0,0,0.4)",
            }}
          >
            Passer
          </Text>
        </Pressable>

        {/* Dots */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i === currentIndex ? colors.ink : "rgba(0,0,0,0.2)",
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={28} color={colors.primary} strokeWidth={3} />
        </Pressable>
      </View>
    </View>
  );
}

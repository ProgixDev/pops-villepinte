import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowRight, Bell, Heart } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import FloatingCartBar from "@/components/cart/FloatingCartBar";
import PopupOverlay from "@/components/home/PopupOverlay";
import {
  SkeletonHeroSlide,
  SkeletonTopPickCard,
} from "@/components/common/Skeleton";
import Screen from "@/components/layout/Screen";
import CategoryChip from "@/components/menu/CategoryChip";
import { displayNameOrFallback } from "@/constants/profile";
import { ROUTES } from "@/constants/routes";
import { colors, font, radius } from "@/constants/theme";
import { useDeferredMount } from "@/hooks/useDeferredMount";
import { formatPriceEUR } from "@/lib/format";
import { requestLocationOncePerSession } from "@/lib/location";
import { useMenuStore } from "@/store/menu.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useProfileStore } from "@/store/profile.store";
import type { Product } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require("../../../assets/images/pops-logo.png") as number;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 20 * 2 - 12) / 2;
const HERO_H_PADDING = 20;
const HERO_SLIDE_WIDTH = SCREEN_WIDTH - HERO_H_PADDING * 2;
const HERO_AUTOPLAY_MS = 4500;

const DEFAULT_MARQUEE_TEXT =
  "FAIT MAISON 🔥   SMASH BURGERS   TACOS   BOWLS   WRAPS   DU PEUPLE POUR LE PEUPLE 💛   VILLEPINTE 93   VIENS RÉCUPÉRER   CASH OU CB";

function MarqueeTape({ text }: { text?: string | null }): React.ReactElement {
  const translateX = useRef(new RNAnimated.Value(0)).current;
  // CMS-driven; pad the end so consecutive copies don't touch.
  const base = text && text.trim() ? text.trim() : DEFAULT_MARQUEE_TEXT;
  const segment = `${base}     `;

  // Width of ONE rendered copy, measured at runtime. Driving the loop off the
  // real measured width (rather than a hardcoded SCREEN_WIDTH multiple) keeps it
  // a single line + seamless for any text length or screen size.
  const [copyWidth, setCopyWidth] = useState(0);

  useEffect(() => {
    if (copyWidth <= 0) return;
    translateX.setValue(0);
    // Constant scroll speed (~60px/s) regardless of text length.
    const anim = RNAnimated.loop(
      RNAnimated.timing(translateX, {
        toValue: -copyWidth,
        duration: (copyWidth / 60) * 1000,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [copyWidth, translateX]);

  const segmentStyle = {
    fontFamily: font.display,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.primary,
  } as const;

  return (
    <View
      style={{
        overflow: "hidden",
        backgroundColor: colors.accent,
        height: 28,
        justifyContent: "center",
        marginTop: 14,
      }}
    >
      <RNAnimated.View
        style={{
          flexDirection: "row",
          transform: [{ translateX }],
        }}
      >
        {/* First copy is measured; both forced to a single line so the bar is
            always exactly one row tall, never wrapping. */}
        <Text
          numberOfLines={1}
          onLayout={(e) => setCopyWidth(e.nativeEvent.layout.width)}
          style={segmentStyle}
        >
          {segment}
        </Text>
        <Text numberOfLines={1} style={segmentStyle}>
          {segment}
        </Text>
      </RNAnimated.View>
    </View>
  );
}

function SignatureSlide({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Commander ${product.name}`}
      onPress={onPress}
      style={{
        width: HERO_SLIDE_WIDTH,
        backgroundColor: colors.primary,
        borderRadius: radius.xl,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          height: 220,
        }}
      >
        <View
          style={{
            flex: 1,
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.ink,
              alignSelf: "flex-start",
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 3,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 9,
                letterSpacing: 2,
                color: colors.primary,
              }}
            >
              SIGNATURE
            </Text>
          </View>

          <Text
            numberOfLines={2}
            style={{
              fontFamily: font.display,
              fontSize: 32,
              lineHeight: 34,
              color: colors.ink,
              letterSpacing: 1,
            }}
          >
            {product.name.toUpperCase()}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              fontFamily: font.body,
              fontSize: 12,
              lineHeight: 16,
              color: "rgba(0,0,0,0.55)",
              marginTop: 4,
            }}
          >
            {product.description}
          </Text>

          <View
            style={{
              backgroundColor: colors.ink,
              alignSelf: "flex-start",
              borderRadius: radius.pill,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: "auto",
            }}
          >
            <Text
              style={{
                fontFamily: font.bodyBold,
                fontSize: 12,
                color: colors.white,
                letterSpacing: 0.5,
              }}
            >
              COMMANDER
            </Text>
            <ArrowRight size={14} color={colors.white} strokeWidth={2.5} />
          </View>
        </View>

        <View style={{ width: "42%", position: "relative" }}>
          <Image
            source={product.image_url}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
            accessibilityIgnoresInvertColors
          />
          <View
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              backgroundColor: colors.primary,
              borderRadius: radius.sm,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 22,
                color: colors.ink,
              }}
            >
              {formatPriceEUR(product.price_eur)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const HERO_TRANSITION_MS = 700;
const HERO_SLIDE_STEP = HERO_SLIDE_WIDTH + 12;

function SignatureCarousel({
  products,
}: {
  products: Product[];
}): React.ReactElement | null {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (activeIndex >= products.length) {
      setActiveIndex(0);
    }
  }, [products.length, activeIndex]);

  useEffect(() => {
    translateX.value = withTiming(-activeIndex * HERO_SLIDE_STEP, {
      duration: HERO_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, translateX]);

  useEffect(() => {
    if (products.length <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % products.length);
    }, HERO_AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [products.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (products.length === 0) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <View
        style={{
          paddingHorizontal: HERO_H_PADDING,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[{ flexDirection: "row", gap: 12 }, animatedStyle]}
        >
          {products.map((p) => (
            <SignatureSlide
              key={p.id}
              product={p}
              onPress={() => router.push(ROUTES.productDetail(p.id))}
            />
          ))}
        </Animated.View>
      </View>

      {products.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
          }}
        >
          {products.map((p, i) => {
            const active = i === activeIndex;
            return (
              <View
                key={p.id}
                style={{
                  width: active ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: active ? colors.ink : "rgba(0,0,0,0.2)",
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function AccueilScreen(): React.ReactElement {
  const router = useRouter();
  const name = useProfileStore((s) => s.profile.name);
  const PRODUCTS = useMenuStore((s) => s.products);
  const CATEGORIES = useMenuStore((s) => s.categories);
  const SIGNATURES = useMenuStore((s) => s.signatures);
  const homeContent = useMenuStore((s) => s.homeContent);
  const menuLoading = useMenuStore((s) => s.loading);
  const fetchMenu = useMenuStore((s) => s.fetchMenu);

  // Root `_layout.tsx` already fetches the menu at app boot. Only refetch here
  // as a defensive fallback when the store is empty (e.g. first install before
  // the persisted cache hydrates). Refetching on every tab focus is what
  // caused the 1-2s transition jank.
  useEffect(() => {
    if (PRODUCTS.length === 0) void fetchMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ask for GPS access once, right after the customer lands on the home screen
  // (i.e. post sign-in). Doing it here means the address picker later opens with
  // permission already resolved — never prompting (and never crashing) mid-map.
  useEffect(() => {
    void requestLocationOncePerSession();
  }, []);

  const heroProducts = useMemo<Product[]>(() => {
    // Admin can feature any number of signatures — show them all.
    if (SIGNATURES.length > 0) return SIGNATURES;
    const fallback = PRODUCTS.find((p) => p.tags.includes("TOP")) ?? PRODUCTS[0];
    return fallback ? [fallback] : [];
  }, [SIGNATURES, PRODUCTS]);
  const topPicks = useMemo(
    () => PRODUCTS.filter((p) => p.tags.includes("TOP")).slice(0, 6),
    [PRODUCTS],
  );
  const newItems = useMemo(
    () => PRODUCTS.filter((p) => p.tags.includes("NOUVEAU")).slice(0, 4),
    [PRODUCTS],
  );

  const greetingName = displayNameOrFallback(name);

  // Defer below-the-fold sections (top picks, nouveautés, story, footer) until
  // after first paint so navigation into the home tab feels instant. Each of
  // these sections includes an image-heavy ScrollView; mounting them all
  // synchronously on cold start is what causes the freeze.
  const heavyReady = useDeferredMount();

  return (
    <Screen floatingBottom={<FloatingCartBar />}>
      {/* ── LOGO + BELL ── */}
      <View
        style={{
          paddingTop: 8,
          paddingBottom: 8,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Image
          source={logoImage}
          contentFit="contain"
          style={{ width: 50, height: 50 }}
        />
        <View
          style={{
            position: "absolute",
            right: 20,
            top: 8,
            bottom: 8,
            justifyContent: "center",
          }}
        >
          <HomeNotificationsBell />
        </View>
      </View>

      {/* ── GREETING ── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <Text
          style={{
            fontFamily: font.display,
            fontSize: 42,
            lineHeight: 44,
            color: colors.ink,
            letterSpacing: 1,
          }}
        >
          Salam, {greetingName} !
        </Text>
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 14,
            color: colors.inkMuted,
            marginTop: 2,
          }}
        >
          Qu&apos;est-ce qui te fait envie ?
        </Text>
      </View>

      {/* ── MARQUEE TAPE (deferred; placeholder reserves 42px to avoid layout shift) ── */}
      {heavyReady ? (
        <MarqueeTape text={homeContent?.marquee_text} />
      ) : (
        <View style={{ height: 42 }} />
      )}

      {/* ── HERO SIGNATURE CAROUSEL ── */}
      {heroProducts.length > 0 && heavyReady ? (
        <SignatureCarousel products={heroProducts} />
      ) : (
        <SkeletonHeroSlide />
      )}

      {/* ── CATEGORIES ── */}
      <View style={{ marginTop: 24 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 24,
              color: colors.ink,
              letterSpacing: 0.5,
            }}
          >
            CATEGORIES
          </Text>
          <Text
            style={{
              fontFamily: font.bodySemi,
              fontSize: 12,
              color: colors.inkMuted,
            }}
          >
            {CATEGORIES.length} choix
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              category={cat}
              onPress={() => router.push(ROUTES.menuCategory(cat.id))}
            />
          ))}
        </ScrollView>
      </View>

      {/* Deferred sections — mount after first paint to keep navigation snappy. */}
      {heavyReady ? (
      <>
      {/* ── TOP PICKS ── */}
      <View style={{ marginTop: 24 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 24,
                color: colors.ink,
                letterSpacing: 0.5,
              }}
            >
              LES ENVIES DU MOMENT
            </Text>
            <Text
              style={{
                fontFamily: font.body,
                fontSize: 12,
                color: colors.inkMuted,
                marginTop: 1,
              }}
            >
              Notre sélection de la semaine
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir tout le menu"
            onPress={() => router.push(ROUTES.menu)}
            style={{
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: colors.ink,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Text
              style={{
                fontFamily: font.bodySemi,
                fontSize: 12,
                color: colors.ink,
              }}
            >
              Voir tout
            </Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        >
          {topPicks.length === 0 && menuLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <SkeletonTopPickCard key={`skel-top-${i}`} width={CARD_WIDTH} />
              ))
            : topPicks.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.productDetail(p.id))}
              style={{
                width: CARD_WIDTH,
                overflow: "hidden",
                backgroundColor: colors.white,
              }}
            >
              <View style={{ position: "relative" }}>
                <Image
                  source={p.image_url}
                  contentFit="cover"
                  style={{
                    width: "100%",
                    height: CARD_WIDTH * 0.85,
                    borderTopLeftRadius: radius.lg,
                    borderTopRightRadius: radius.lg,
                  }}
                  accessibilityIgnoresInvertColors
                />
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.9)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Heart size={16} color={colors.ink} strokeWidth={2} />
                </View>
              </View>
              <View style={{ padding: 12 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: font.bodySemi,
                    fontSize: 15,
                    color: colors.ink,
                  }}
                >
                  {p.name}
                </Text>
                <Text
                  style={{
                    fontFamily: font.bodyBold,
                    fontSize: 16,
                    color: colors.ink,
                    marginTop: 4,
                  }}
                >
                  {formatPriceEUR(p.price_eur)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── NOUVEAUTES ── */}
      {newItems.length > 0 ? (
        <View style={{ marginTop: 24 }}>
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 24,
                color: colors.ink,
                letterSpacing: 0.5,
              }}
            >
              NOUVEAUTÉS
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {newItems.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: "/product/[id]", params: { id: p.id } })
                }
                style={{
                  width: CARD_WIDTH,
                  overflow: "hidden",
                  backgroundColor: colors.white,
                }}
              >
                <Image
                  source={p.image_url}
                  contentFit="cover"
                  style={{
                    width: "100%",
                    height: CARD_WIDTH * 0.85,
                    borderTopLeftRadius: radius.lg,
                    borderTopRightRadius: radius.lg,
                  }}
                  accessibilityIgnoresInvertColors
                />
                <View style={{ padding: 12 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: font.bodySemi,
                      fontSize: 15,
                      color: colors.ink,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: font.bodyBold,
                      fontSize: 16,
                      color: colors.ink,
                      marginTop: 4,
                    }}
                  >
                    {formatPriceEUR(p.price_eur)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── STORY ── */}
      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <View
          style={{
            backgroundColor: colors.cardDark,
            borderRadius: radius.lg,
            padding: 22,
          }}
        >
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 28,
              color: colors.primary,
              letterSpacing: 0.5,
            }}
          >
            {homeContent?.story_title?.trim() || "POP'S VILLEPINTE"}
          </Text>
          <View
            style={{
              width: 36,
              height: 3,
              backgroundColor: colors.primary,
              marginVertical: 10,
              borderRadius: 2,
            }}
          />
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 13,
              lineHeight: 20,
              color: "rgba(255,255,255,0.8)",
            }}
          >
            {homeContent?.story_body?.trim() ||
              "Abdoullah en cuisine, fait maison chaque jour. Smash burgers, bowls, tacos — du peuple, pour le peuple."}
          </Text>
        </View>
      </View>

      {/* ── FOOTER ── */}
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 20,
          marginTop: 28,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            width: 36,
            height: 3,
            backgroundColor: colors.primary,
            marginBottom: 10,
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
          Ouvert 11h – 00h · 06 51 30 XX XX
        </Text>
      </View>
      </>
      ) : null}
      <PopupOverlay />
    </Screen>
  );
}

function HomeNotificationsBell(): React.ReactElement {
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
              color: "#fff",
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

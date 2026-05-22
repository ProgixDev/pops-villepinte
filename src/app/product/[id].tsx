import { useMemo, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Heart, Star, Timer, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Toast from "@/components/common/Toast";
import NotesField from "@/components/menu/NotesField";
import QuantityStepper from "@/components/menu/QuantityStepper";
import SupplementSelector from "@/components/menu/SupplementSelector";
import VariantSelector from "@/components/menu/VariantSelector";
import { colors, font, radius, shadow } from "@/constants/theme";
import { formatPriceEUR } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useMenuStore } from "@/store/menu.store";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ROUTE_BACK_DELAY_MS = 900;

function resolveVariantLabel(categoryId: string): string {
  if (categoryId === "smash-burgers") return "Nombre de steaks";
  if (categoryId === "bowls" || categoryId === "box") return "Taille";
  if (categoryId === "bucket") return "Format";
  return "Options";
}

export default function ProductDetailScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const getProductById = useMenuStore((s) => s.getProductById);
  const supplements = useMenuStore((s) => s.supplements);
  const product = useMemo(() => getProductById(id), [id, getProductById]);
  const addItem = useCartStore((s) => s.addItem);
  const isFavorite = useFavoritesStore((s) =>
    id ? s.productIds.includes(id) : false,
  );
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const [variantId, setVariantId] = useState<string | undefined>(
    product?.product_variants?.[0]?.id,
  );
  const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>
          Produit introuvable
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 24 }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: 14, color: colors.primary }}>
            Retour au menu
          </Text>
        </Pressable>
      </View>
    );
  }

  const applicableSupplements = useMemo(
    () => {
      const productSupIds = product.product_supplements?.map((ps) => ps.supplement_id) ?? [];
      return supplements.filter((s) => productSupIds.includes(s.id));
    },
    [product, supplements],
  );

  const selectedVariant = product.product_variants?.find((v) => v.id === variantId);
  const basePrice = selectedVariant?.price_eur ?? product.price_eur;
  const supplementsTotal = selectedSupplements.reduce((acc, sid) => {
    const s = supplements.find((x) => x.id === sid);
    return acc + (s?.price_eur ?? 0);
  }, 0);
  const lineTotal = (basePrice + supplementsTotal) * quantity;
  const hasVariants = product.product_variants !== undefined && product.product_variants.length > 0;

  const handleToggleSupplement = (sid: string): void => {
    setSelectedSupplements((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  };

  const handleAddToCart = (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem({
      productId: product.id,
      variantId,
      quantity,
      supplements: selectedSupplements,
      notes: notes.trim().length > 0 ? notes.trim() : undefined,
    });
    setToastVisible(true);
    setTimeout(() => { router.back(); }, ROUTE_BACK_DELAY_MS);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* ── HERO IMAGE — full width, dark backdrop ── */}
        <View style={{ backgroundColor: colors.cardDark, position: "relative" }}>
          {/* Nav bar */}
          <View
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 16,
              right: 16,
              zIndex: 20,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
                ...shadow.card,
              }}
            >
              <ArrowLeft size={20} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isFavorite
                    ? "Retirer des favoris"
                    : "Ajouter aux favoris"
                }
                accessibilityState={{ selected: isFavorite }}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void toggleFavorite(product.id);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.card,
                }}
              >
                <Heart
                  size={20}
                  color={isFavorite ? colors.primary : colors.ink}
                  strokeWidth={2}
                  fill={isFavorite ? colors.primary : "transparent"}
                />
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.card,
                }}
              >
                <X size={20} color={colors.ink} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Product image */}
          <Image
            source={product.image_url}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_WIDTH * 0.85,
            }}
            transition={300}
            accessibilityIgnoresInvertColors
          />

          {/* Price badge overlay */}
          <View
            style={{
              position: "absolute",
              bottom: 16,
              left: 20,
              backgroundColor: colors.primary,
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              paddingVertical: 6,
              ...shadow.card,
            }}
          >
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 28,
                color: colors.ink,
              }}
            >
              {hasVariants ? "dès " : ""}{formatPriceEUR(basePrice)}
            </Text>
          </View>

          {/* Prep time badge */}
          <View
            style={{
              position: "absolute",
              bottom: 16,
              right: 20,
              backgroundColor: "rgba(0,0,0,0.7)",
              borderRadius: radius.pill,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Timer size={14} color={colors.white} strokeWidth={2} />
            <Text
              style={{
                fontFamily: font.bodySemi,
                fontSize: 12,
                color: colors.white,
              }}
            >
              {product.prep_time_minutes} min
            </Text>
          </View>
        </View>

        {/* ── CONTENT ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Tags */}
          {product.tags.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {product.tags.slice(0, 2).map((t) => (
                <View
                  key={t}
                  style={{
                    backgroundColor: t === "SPICY" ? colors.accent : colors.primary,
                    borderRadius: radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.bodyBold,
                      fontSize: 10,
                      letterSpacing: 2,
                      color: t === "SPICY" ? colors.white : colors.ink,
                      textTransform: "uppercase",
                    }}
                  >
                    {t}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  marginLeft: 4,
                }}
              >
                <Star size={14} color={colors.primary} strokeWidth={2.5} fill={colors.primary} />
                <Text style={{ fontFamily: font.bodySemi, fontSize: 12, color: colors.ink }}>
                  4.8
                </Text>
              </View>
            </View>
          ) : null}

          {/* Name */}
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 42,
              lineHeight: 44,
              letterSpacing: 1,
              color: colors.ink,
            }}
          >
            {product.name.toUpperCase()}
          </Text>

          {/* Description */}
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 14,
              lineHeight: 22,
              color: colors.inkMuted,
              marginTop: 8,
            }}
          >
            {product.description}
          </Text>

          {/* Info pills */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <View
              style={{
                backgroundColor: "#F5F5F5",
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Timer size={14} color={colors.inkMuted} strokeWidth={2} />
              <Text style={{ fontFamily: font.bodySemi, fontSize: 12, color: colors.ink }}>
                {product.prep_time_minutes} min
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "#F5F5F5",
                borderRadius: radius.pill,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ fontFamily: font.bodySemi, fontSize: 12, color: colors.ink }}>
                Retrait sur place
              </Text>
            </View>
          </View>
        </View>

        {/* Separator */}
        <View style={{ height: 8, backgroundColor: "#F5F5F5", marginTop: 20 }} />

        {/* ── VARIANTS ── */}
        {hasVariants ? (
          <>
            <VariantSelector
              variants={product.product_variants!}
              selectedId={variantId}
              onSelect={setVariantId}
              label={resolveVariantLabel(product.category_id)}
            />
            <View style={{ height: 8, backgroundColor: "#F5F5F5" }} />
          </>
        ) : null}

        {/* ── SUPPLEMENTS ── */}
        {applicableSupplements.length > 0 ? (
          <>
            <SupplementSelector
              supplements={applicableSupplements}
              selectedIds={selectedSupplements}
              onToggle={handleToggleSupplement}
            />
            <View style={{ height: 8, backgroundColor: "#F5F5F5" }} />
          </>
        ) : null}

        {/* ── QUANTITY ── */}
        <QuantityStepper value={quantity} onChange={setQuantity} />

        <View style={{ height: 8, backgroundColor: "#F5F5F5", marginTop: 20 }} />

        {/* ── NOTES ── */}
        <NotesField value={notes} onChange={setNotes} />
      </ScrollView>

      {/* ── STICKY CTA ── */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.white,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ajouter au panier pour ${formatPriceEUR(lineTotal)}`}
          onPress={handleAddToCart}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingVertical: 16,
            ...shadow.hero,
          }}
        >
          <Text
            style={{
              fontFamily: font.bodyBold,
              fontSize: 15,
              color: colors.ink,
              letterSpacing: 0.5,
            }}
          >
            AJOUTER AU PANIER
          </Text>
          <View
            style={{
              backgroundColor: colors.ink,
              borderRadius: radius.sm,
              paddingHorizontal: 14,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 20,
                color: colors.primary,
              }}
            >
              {formatPriceEUR(lineTotal)}
            </Text>
          </View>
        </Pressable>
      </View>

      <Toast
        visible={toastVisible}
        message="Ajouté au panier"
        onHide={() => setToastVisible(false)}
        duration={ROUTE_BACK_DELAY_MS}
      />
    </View>
  );
}

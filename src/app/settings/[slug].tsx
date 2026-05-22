import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Award,
  Bell,
  Clock,
  FileText,
  Heart,
  MapPin,
  Phone,
} from "lucide-react-native";

import ProductCard from "@/components/menu/ProductCard";
import { useFavoritesStore } from "@/store/favorites.store";
import { useMenuStore } from "@/store/menu.store";
import type { Product } from "@/types";

const INK = "#111111";
const MUTED = "#6B6B6B";
const PRIMARY = "#FFCE00";
const WHITE = "#FFFFFF";

const DISPLAY = "BebasNeue_400Regular";
const BODY = "Poppins_400Regular";
const BODY_MEDIUM = "Poppins_500Medium";
const BODY_SEMI = "Poppins_600SemiBold";

type SlugKey = "favoris" | "fidelite" | "notifications" | "conditions" | "contact";

const TITLES: Record<SlugKey, string> = {
  favoris: "Favoris",
  fidelite: "Programme fidélité",
  notifications: "Notifications",
  conditions: "Conditions générales",
  contact: "Nous contacter",
};

/* ─────────────── FAVORIS ─────────────── */
function FavorisContent(): React.ReactElement {
  const favoriteIds = useFavoritesStore((s) => s.productIds);
  const products = useMenuStore((s) => s.products);

  const favoriteProducts = useMemo<Product[]>(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return favoriteIds
      .map((id) => byId.get(id))
      .filter((p): p is Product => p !== undefined);
  }, [favoriteIds, products]);

  if (favoriteProducts.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingTop: 48 }}>
        <Heart size={64} color={PRIMARY} strokeWidth={1.5} />
        <Text
          style={{
            fontFamily: DISPLAY,
            fontSize: 28,
            color: INK,
            marginTop: 24,
            textAlign: "center",
          }}
        >
          Tes plats préférés seront ici.
        </Text>
        <Text
          style={{
            fontFamily: BODY,
            fontSize: 15,
            color: MUTED,
            marginTop: 12,
            textAlign: "center",
            lineHeight: 22,
            paddingHorizontal: 20,
          }}
        >
          Ajoute des favoris depuis le menu en tapant sur le c&#339;ur.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        paddingTop: 16,
        paddingHorizontal: 16,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 16,
      }}
    >
      {favoriteProducts.map((product) => (
        <View key={product.id} style={{ width: "48%" }}>
          <ProductCard product={product} size="sm" />
        </View>
      ))}
    </View>
  );
}

/* ─────────────── FIDELITE ─────────────── */
function FideliteContent(): React.ReactElement {
  return (
    <View style={{ alignItems: "center", paddingTop: 48 }}>
      <Award size={64} color={PRIMARY} strokeWidth={1.5} />
      <Text
        style={{
          fontFamily: DISPLAY,
          fontSize: 28,
          color: INK,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        Programme fidélité
      </Text>
      <Text
        style={{
          fontFamily: BODY,
          fontSize: 15,
          color: MUTED,
          marginTop: 12,
          textAlign: "center",
          lineHeight: 22,
          paddingHorizontal: 20,
        }}
      >
        Bientôt, chaque commande te rapprochera de récompenses exclusives.
      </Text>
      {/* Fake progress bar */}
      <View
        style={{
          width: "80%",
          height: 12,
          backgroundColor: "#F0F0F0",
          borderRadius: 6,
          marginTop: 32,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: "30%",
            height: "100%",
            backgroundColor: PRIMARY,
            borderRadius: 6,
          }}
        />
      </View>
      <Text
        style={{
          fontFamily: BODY_MEDIUM,
          fontSize: 13,
          color: MUTED,
          marginTop: 8,
        }}
      >
        3 / 10 commandes
      </Text>
    </View>
  );
}

/* ─────────────── NOTIFICATIONS ─────────────── */
function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
      }}
    >
      <Text style={{ fontFamily: BODY_SEMI, fontSize: 15, color: INK }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={onToggle}
        style={{
          width: 50,
          height: 30,
          borderRadius: 15,
          backgroundColor: value ? PRIMARY : "#E0E0E0",
          justifyContent: "center",
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: WHITE,
            alignSelf: value ? "flex-end" : "flex-start",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 3,
            elevation: 3,
          }}
        />
      </Pressable>
    </View>
  );
}

function NotificationsContent(): React.ReactElement {
  const [main, setMain] = useState(true);
  const [products, setProducts] = useState(true);
  const [promos, setPromos] = useState(false);

  return (
    <View style={{ paddingTop: 32 }}>
      <Bell
        size={48}
        color={PRIMARY}
        strokeWidth={1.5}
        style={{ alignSelf: "center", marginBottom: 24 }}
      />
      <View style={{ paddingHorizontal: 20 }}>
        <ToggleRow
          label="Activer les notifications"
          value={main}
          onToggle={() => setMain((v) => !v)}
        />
        <ToggleRow
          label="Nouveaux produits"
          value={products}
          onToggle={() => setProducts((v) => !v)}
        />
        <ToggleRow
          label="Promos"
          value={promos}
          onToggle={() => setPromos((v) => !v)}
        />
      </View>
    </View>
  );
}

/* ─────────────── CONDITIONS ─────────────── */
function ConditionsContent(): React.ReactElement {
  return (
    <View style={{ paddingTop: 32 }}>
      <FileText
        size={48}
        color={PRIMARY}
        strokeWidth={1.5}
        style={{ alignSelf: "center", marginBottom: 24 }}
      />
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <Text style={{ fontFamily: BODY, fontSize: 14, color: MUTED, lineHeight: 22 }}>
          Les présentes conditions générales régissent l'utilisation de
          l'application Pop's Villepinte. En accédant à l'application, vous
          acceptez d'être lié par ces conditions. L'application est destinée
          à faciliter la commande de produits alimentaires proposés par
          l'établissement Pop's, situé à Villepinte (93420).
        </Text>
        <Text style={{ fontFamily: BODY, fontSize: 14, color: MUTED, lineHeight: 22 }}>
          Les informations présentées sur l'application, notamment les prix,
          descriptions et images des produits, sont fournies à titre indicatif
          et peuvent être modifiées à tout moment sans préavis. Pop's Villepinte
          se réserve le droit de modifier, suspendre ou interrompre tout ou
          partie du service à tout moment.
        </Text>
        <Text style={{ fontFamily: BODY, fontSize: 14, color: MUTED, lineHeight: 22 }}>
          Les données personnelles collectées dans le cadre de l'utilisation
          de l'application sont traitées conformément à la réglementation en
          vigueur. Elles sont utilisées uniquement pour le traitement des
          commandes et l'amélioration de nos services. Vous disposez d'un
          droit d'accès, de rectification et de suppression de vos données
          en contactant directement l'établissement.
        </Text>
      </View>
    </View>
  );
}

/* ─────────────── CONTACT ─────────────── */
function ContactInfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F0F0F0",
        gap: 16,
      }}
    >
      <View
        style={{
          backgroundColor: "#FFF8D6",
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={INK} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: BODY_MEDIUM,
            fontSize: 12,
            color: MUTED,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: BODY_SEMI,
            fontSize: 15,
            color: INK,
            marginTop: 2,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function ContactContent(): React.ReactElement {
  return (
    <View style={{ paddingTop: 32, paddingHorizontal: 20 }}>
      <ContactInfoRow icon={Phone} label="Téléphone" value="06 51 30 XX XX" />
      <ContactInfoRow
        icon={MapPin}
        label="Adresse"
        value="Avenue Gabriel Péri, 93420 Villepinte"
      />
      <ContactInfoRow icon={Clock} label="Horaires" value="11h - 00h" />
    </View>
  );
}

/* ─────────────── MAIN SCREEN ─────────────── */
export default function SettingsScreen(): React.ReactElement {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const key = (slug ?? "favoris") as SlugKey;
  const title = TITLES[key] ?? "Réglages";

  const renderContent = (): React.ReactElement | null => {
    switch (key) {
      case "favoris":
        return <FavorisContent />;
      case "fidelite":
        return <FideliteContent />;
      case "notifications":
        return <NotificationsContent />;
      case "conditions":
        return <ConditionsContent />;
      case "contact":
        return <ContactContent />;
      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: WHITE,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ArrowLeft size={22} color={INK} strokeWidth={2} />
        </Pressable>
        <Text
          style={{
            fontFamily: DISPLAY,
            fontSize: 36,
            color: INK,
            marginTop: 16,
            letterSpacing: 0.5,
          }}
        >
          {title.toUpperCase()}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

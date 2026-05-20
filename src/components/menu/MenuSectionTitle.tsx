import { Text, View } from "react-native";

import { font } from "@/constants/theme";

export type MenuSectionTitleProps = {
  name: string;
  count: number;
};

export default function MenuSectionTitle({
  name,
  count,
}: MenuSectionTitleProps): React.ReactElement {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <View className="bg-primary" style={{ width: 4, height: 22, borderRadius: 2 }} />
        <Text
          numberOfLines={1}
          className="text-on-surface"
          style={{
            fontFamily: font.bodyExtraBoldItalic,
            fontSize: 26,
            lineHeight: 30,
            letterSpacing: -0.8,
          }}
        >
          {name}
        </Text>
      </View>
      <Text
        className="text-on-surface-variant"
        style={{
          fontFamily: font.bodySemi,
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {count} créations
      </Text>
    </View>
  );
}

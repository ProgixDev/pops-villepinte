import { Dimensions, View } from "react-native";
import { Image } from "expo-image";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const burgerIll = require("../../../assets/images/burgerillustartion.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const friesIll = require("../../../assets/images/friesillustartion.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tacosIll = require("../../../assets/images/tacosillustartion.png") as number;

const ICONS = [burgerIll, friesIll, tacosIll];
const ROTATIONS = [
  -10, 14, -6, 18, -12, 8, -16, 10, -4, 20, -8, 12, -14, 6, -18, 16,
];

const SCREEN_WIDTH = Dimensions.get("window").width;

export type FoodPatternProps = {
  /** Height in pixels of the area to fill. */
  height: number;
  /** 0..1; defaults differ between marketing screens (0.6) and content backgrounds (0.12). */
  opacity?: number;
};

/**
 * Decorative tiled food illustration grid. Renders as an absolutely-positioned
 * full-bleed layer; the parent decides where to put it (top/bottom, full screen,
 * etc.) by wrapping in a sized container.
 */
export default function FoodPattern({
  height,
  opacity = 0.6,
}: FoodPatternProps): React.ReactElement {
  const rows = Math.ceil(height / 70) + 2;
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
            opacity,
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
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height,
      }}
    >
      {items}
    </View>
  );
}

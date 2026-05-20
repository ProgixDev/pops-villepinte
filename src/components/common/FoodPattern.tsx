import { memo, useMemo } from "react";
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

// Snap the requested height up to the nearest 1000px so onLayout updates that
// shift the content height by a few hundred pixels don't trigger a full grid
// rebuild. The pattern overshoots harmlessly into the unseen area.
const HEIGHT_GRANULARITY = 1000;

// Tile dimensions per density. "dense" matches the original auth-screen visual;
// "sparse" is for subtle background use (e.g. menu at opacity 0.12) where the
// extra ~5-6x node count of dense mode is the dominant mount cost and not
// visually justified.
const DENSITY = {
  dense: { iconSize: 40, rowH: 70, colW: 55 },
  sparse: { iconSize: 64, rowH: 130, colW: 100 },
} as const;

export type FoodPatternDensity = keyof typeof DENSITY;

export type FoodPatternProps = {
  /** Height in pixels of the area to fill. */
  height: number;
  /** 0..1; defaults differ between marketing screens (0.6) and content backgrounds (0.12). */
  opacity?: number;
  /** Grid density. "sparse" mounts ~5-6x fewer nodes — use for subtle backgrounds. */
  density?: FoodPatternDensity;
};

function FoodPatternImpl({
  height,
  opacity = 0.6,
  density = "dense",
}: FoodPatternProps): React.ReactElement {
  const snappedHeight = Math.max(
    HEIGHT_GRANULARITY,
    Math.ceil(height / HEIGHT_GRANULARITY) * HEIGHT_GRANULARITY,
  );

  const items = useMemo(() => {
    const { iconSize, rowH, colW } = DENSITY[density];
    const rows = Math.ceil(snappedHeight / rowH) + 2;
    const cols = Math.ceil(SCREEN_WIDTH / colW);
    const out: React.ReactElement[] = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const src = ICONS[idx % ICONS.length]!;
        const rot = ROTATIONS[idx % ROTATIONS.length]!;
        out.push(
          <View
            key={`${r}-${c}`}
            style={{
              position: "absolute",
              width: iconSize,
              height: iconSize,
              top: r * rowH + (c % 2 === 0 ? 0 : rowH / 2),
              left: c * colW + (r % 2 === 0 ? 0 : colW / 2),
              transform: [{ rotate: `${rot}deg` }],
              opacity,
            }}
          >
            <Image
              source={src}
              contentFit="contain"
              style={{ width: iconSize, height: iconSize }}
            />
          </View>,
        );
        idx++;
      }
    }
    return out;
  }, [snappedHeight, opacity, density]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: snappedHeight,
      }}
    >
      {items}
    </View>
  );
}

/**
 * Decorative tiled food illustration grid. Renders as an absolutely-positioned
 * full-bleed layer; the parent decides where to put it (top/bottom, full screen,
 * etc.) by wrapping in a sized container.
 *
 * Heavy on mount (~hundreds of nodes), so:
 *  - memoized: only re-renders when props change
 *  - height snapped to a coarse boundary so onLayout updates don't rebuild
 */
const FoodPattern = memo(FoodPatternImpl);
export default FoodPattern;

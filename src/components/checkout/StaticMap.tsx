import { useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { MapPin } from "lucide-react-native";

import { colors } from "@/constants/theme";

const TILE_SIZE = 256;
const ZOOM = 15;

/**
 * Tiny OSM-tile static map. No native maps dependency — we just render the
 * three raster tiles around the requested point and clip them so the marker
 * lands dead-centre. Good enough for a checkout preview, no API key needed.
 */
export type StaticMapProps = {
  lat: number;
  lng: number;
  height?: number;
  /** Optional second marker (e.g. the storefront) shown in muted yellow. */
  secondaryLat?: number;
  secondaryLng?: number;
};

function lon2x(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z);
}

function lat2y(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

export default function StaticMap({
  lat,
  lng,
  height = 180,
  secondaryLat,
  secondaryLng,
}: StaticMapProps): React.ReactElement {
  const tiles = useMemo(() => {
    const fx = lon2x(lng, ZOOM);
    const fy = lat2y(lat, ZOOM);
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    // Sub-pixel offset of the centre point within its tile.
    const offX = (fx - cx) * TILE_SIZE;
    const offY = (fy - cy) * TILE_SIZE;

    const grid: { x: number; y: number; dx: number; dy: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        grid.push({ x: cx + dx, y: cy + dy, dx, dy });
      }
    }

    let secondary: { x: number; y: number } | null = null;
    if (secondaryLat !== undefined && secondaryLng !== undefined) {
      const sx = lon2x(secondaryLng, ZOOM);
      const sy = lat2y(secondaryLat, ZOOM);
      secondary = {
        x: (sx - fx) * TILE_SIZE,
        y: (sy - fy) * TILE_SIZE,
      };
    }

    return { grid, offX, offY, secondary };
  }, [lat, lng, secondaryLat, secondaryLng]);

  return (
    <View
      style={{
        height,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#E6E2D7",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          // Pull the grid so that the (lat,lng) sub-pixel lands on screen centre.
          marginLeft: -tiles.offX - TILE_SIZE,
          marginTop: -tiles.offY - TILE_SIZE,
          width: TILE_SIZE * 3,
          height: TILE_SIZE * 3,
        }}
      >
        {tiles.grid.map((t) => (
          <Image
            key={`${t.x}-${t.y}`}
            source={`https://tile.openstreetmap.org/${ZOOM}/${t.x}/${t.y}.png`}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            style={{
              position: "absolute",
              width: TILE_SIZE,
              height: TILE_SIZE,
              left: (t.dx + 1) * TILE_SIZE,
              top: (t.dy + 1) * TILE_SIZE,
            }}
          />
        ))}

        {/* Storefront marker (when provided). Drawn before the destination so
            the destination pin sits on top. */}
        {tiles.secondary !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: TILE_SIZE * 1.5 + tiles.secondary.x - 14,
              top: TILE_SIZE * 1.5 + tiles.secondary.y - 28,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.ink,
              shadowOpacity: 0.25,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.ink,
              }}
            />
          </View>
        ) : null}
      </View>

      {/* Destination pin, anchored dead centre via the marginLeft/Top math above. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          marginLeft: -18,
          marginTop: -40,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.accent,
            borderWidth: 3,
            borderColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.ink,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <MapPin size={18} color={colors.white} strokeWidth={2.5} />
        </View>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.accent,
            marginTop: -2,
          }}
        />
      </View>
    </View>
  );
}

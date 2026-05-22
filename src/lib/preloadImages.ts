import { Image as RNImage } from "react-native";
import { Image } from "expo-image";

// Heavy images shown across the onboarding + auth flow. The PNG files are
// 2-4 MB each; decoding all of them while a screen transition is animating
// can spike RAM enough to OOM on low-end Androids. Preload them while the
// splash video is still playing so the decoded bitmaps live in expo-image's
// memory cache by the time the user reaches those screens.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const burgerImage = require("../../assets/images/burger.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tendersImage = require("../../assets/images/tenders.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tacosImage = require("../../assets/images/tacos.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const popsLogo = require("../../assets/images/pops-logo.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const burgerIll = require("../../assets/images/burgerillustartion.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const friesIll = require("../../assets/images/friesillustartion.png") as number;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tacosIll = require("../../assets/images/tacosillustartion.png") as number;

const ONBOARDING_MODULES = [burgerImage, tendersImage, tacosImage] as const;
const AUTH_MODULES = [popsLogo, burgerIll, friesIll, tacosIll] as const;

function uriFor(mod: number): string | null {
  try {
    const src = RNImage.resolveAssetSource(mod);
    return src?.uri ?? null;
  } catch {
    return null;
  }
}

async function prefetchOne(mod: number): Promise<void> {
  const uri = uriFor(mod);
  if (!uri) return;
  try {
    await Image.prefetch(uri, "memory-disk");
  } catch {
    // Best-effort: a failed prefetch just means the image will decode on
    // first render. Never throw — this runs during splash.
  }
}

/**
 * Sequentially prefetch the heavy onboarding + auth images so decode work
 * is spread over the splash window instead of stacked at navigation time.
 * Returns once all attempts have completed (success or swallowed failure).
 */
export async function preloadFlowImages(): Promise<void> {
  // Serial, not Promise.all — parallel decode of 7 large PNGs is itself a
  // memory spike that can crash low-end devices, which is exactly what we're
  // trying to avoid.
  for (const mod of [...ONBOARDING_MODULES, ...AUTH_MODULES]) {
    await prefetchOne(mod);
  }
}

import Mapbox from "@rnmapbox/maps";

import { STORE_LAT, STORE_LNG, type DeliveryAddress } from "./delivery";

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;

let initialised = false;

/** Idempotent — safe to call from any module entry. */
export function initMapbox(): void {
  if (initialised) return;
  if (!TOKEN) {
    if (__DEV__) {
      console.warn(
        "[mapbox] EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN not set — map screens will render blank.",
      );
    }
    return;
  }
  Mapbox.setAccessToken(TOKEN);
  // Quieter telemetry — opt-out is the polite default for restaurants apps.
  void Mapbox.setTelemetryEnabled(false);
  initialised = true;
}

// Eager init: importing this module is enough to wire the token.
initMapbox();

export const MAPBOX_STYLE_STREETS = "mapbox://styles/mapbox/streets-v12";

// ──────────────────────────────────────────────────────────────────────────
// Geocoding helpers — Mapbox Search (Places) API
// https://docs.mapbox.com/api/search/geocoding-v5/
// ──────────────────────────────────────────────────────────────────────────

type MapboxFeature = {
  id: string;
  place_name: string;
  text?: string;
  center: [number, number]; // [lng, lat]
  context?: { id: string; text: string }[];
  properties?: { accuracy?: string };
};

function featureToAddress(f: MapboxFeature): DeliveryAddress {
  const postcode = f.context?.find((c) => c.id.startsWith("postcode"))?.text;
  const city =
    f.context?.find((c) => c.id.startsWith("place"))?.text ??
    f.context?.find((c) => c.id.startsWith("locality"))?.text;
  return {
    label: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
    postcode,
    city,
  };
}

/** Forward search — Mapbox geocoding, biased toward the storefront. */
export async function mapboxSearch(
  query: string,
  limit = 6,
): Promise<DeliveryAddress[]> {
  const q = query.trim();
  if (q.length < 3 || !TOKEN) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("country", "fr");
  url.searchParams.set("language", "fr");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("proximity", `${STORE_LNG},${STORE_LAT}`);
  url.searchParams.set("types", "address,place,postcode,locality");

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const body = (await res.json()) as { features?: MapboxFeature[] };
  return (body.features ?? []).map(featureToAddress);
}

/** Reverse geocoding for a single point — returns the best human label. */
export async function mapboxReverseGeocode(
  lat: number,
  lng: number,
): Promise<DeliveryAddress | null> {
  if (!TOKEN) return null;
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
  );
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("country", "fr");
  url.searchParams.set("language", "fr");
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,place,locality");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const body = (await res.json()) as { features?: MapboxFeature[] };
  const first = body.features?.[0];
  if (!first) return null;
  return featureToAddress(first);
}

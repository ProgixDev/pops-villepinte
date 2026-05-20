// Mirror of server/api/src/common/utils/delivery.ts — keep these constants
// in sync. The mobile app uses them to preview fee + zone before the user
// taps "confirmer", server-side validation is authoritative.

export const STORE_LAT = 48.962665;
export const STORE_LNG = 2.541223;
export const STORE_ADDRESS = "Avenue Gabriel Péri, 93420 Villepinte";

export const DELIVERY_FEE_EUR = 3;
export const DELIVERY_MAX_KM = 8;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceFromStoreKm(lat: number, lng: number): number {
  return haversineKm(STORE_LAT, STORE_LNG, lat, lng);
}

export type DeliveryAddress = {
  label: string;
  lat: number;
  lng: number;
  postcode?: string;
  city?: string;
};

// Free French address search — BAN (Base Adresse Nationale).
// https://adresse.data.gouv.fr/api-doc/adresse — no key required, polite use only.
export async function searchFrenchAddresses(
  query: string,
  limit = 5,
): Promise<DeliveryAddress[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  // Bias toward Villepinte (93420) so local addresses surface first.
  url.searchParams.set("lat", String(STORE_LAT));
  url.searchParams.set("lon", String(STORE_LNG));
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const body: unknown = await res.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("features" in body) ||
    !Array.isArray((body as { features: unknown }).features)
  ) {
    return [];
  }
  const features = (body as {
    features: {
      geometry?: { coordinates?: [number, number] };
      properties?: {
        label?: string;
        postcode?: string;
        city?: string;
      };
    }[];
  }).features;
  return features
    .map((f) => {
      const coords = f.geometry?.coordinates;
      const label = f.properties?.label;
      if (!coords || !label) return null;
      return {
        label,
        lng: coords[0],
        lat: coords[1],
        postcode: f.properties?.postcode,
        city: f.properties?.city,
      } as DeliveryAddress;
    })
    .filter((x): x is DeliveryAddress => x !== null);
}

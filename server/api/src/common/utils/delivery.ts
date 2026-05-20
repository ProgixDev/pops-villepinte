/**
 * Delivery fee helpers. The numeric base + per-km rate now come from
 * `shop_settings` (editable by the super-admin), so this file only owns the
 * geometry — the store coordinates and the haversine math.
 */

// POP'S Villepinte storefront — Avenue Gabriel Péri, 93420 Villepinte.
// Coordinates from the BAN (Base Adresse Nationale).
export const STORE_LAT = 48.962665;
export const STORE_LNG = 2.541223;

// Fallback values used when the shop_settings row is missing the columns
// (e.g. legacy DB). The migration sets a default of 3€ base / 0€ per km.
export const DEFAULT_DELIVERY_BASE_FEE_EUR = 3;
export const DEFAULT_DELIVERY_PER_KM_EUR = 0;

/** Great-circle distance in kilometres. */
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

/** fee = base + km * rate, rounded to 2 decimals. */
export function computeDeliveryFee(
  km: number,
  baseFee: number,
  perKmRate: number,
): number {
  const raw = Math.max(0, baseFee) + Math.max(0, km) * Math.max(0, perKmRate);
  return Math.round(raw * 100) / 100;
}

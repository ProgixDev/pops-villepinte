/**
 * Delivery fee + zone helpers. Single source of truth for both the order
 * creation path and the public "is this address deliverable?" surface.
 */

// POP'S Villepinte storefront — Avenue Gabriel Péri, 93420 Villepinte.
// Coordinates from the BAN (Base Adresse Nationale).
export const STORE_LAT = 48.962665;
export const STORE_LNG = 2.541223;

// Flat fee inside the zone; we keep it simple — no per-km tiering until
// operations actually demand it.
export const DELIVERY_FEE_EUR = 3;

// Hard ceiling: anything beyond this is "hors zone" and the API refuses to
// create the order.
export const DELIVERY_MAX_KM = 8;

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

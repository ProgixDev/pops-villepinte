/**
 * French mobile (06/07) parsing, formatting, and validation.
 * Single source of truth for the mobile app — mirrors the server's
 * `normalizeFrenchMobile` in `server/api/src/common/utils/phone.ts`.
 */

export const PHONE_REGEX = /^0[67](\d{2}){4}$/;

const FRENCH_MOBILE_E164 = /^(?:\+33|0033|0)([67]\d{8})$/;

/** Format raw input as `06 12 34 56 78` (max 10 digits, spaces every 2).
 * Accepts local (`0612...`), E.164 (`+33612...`), or international (`0033612...`)
 * forms and always renders the local 10-digit form. */
export function formatFrenchMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // Drop the +33 / 0033 country prefix and prepend the leading 0.
  if (digits.startsWith("0033")) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("33") && digits.length >= 11) {
    digits = "0" + digits.slice(2);
  }
  digits = digits.slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

/** Strip spaces/dashes/dots and return E.164 (`+33...`) or null. */
export function normalizeFrenchMobile(raw: string): string | null {
  const cleaned = raw.replace(/\s|[-.]/g, "");
  const match = cleaned.match(FRENCH_MOBILE_E164);
  if (!match) return null;
  return `+33${match[1]}`;
}

export function isFrenchMobile(raw: string): boolean {
  return normalizeFrenchMobile(raw) !== null;
}

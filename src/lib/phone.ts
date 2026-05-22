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

/**
 * Multi-prefix support for the auth screen. Each option is what the user
 * sees in the country badge; `e164` is what we send to the backend.
 *
 * Note: the "+1" option intentionally resolves to the Algerian dialing
 * code "+213" — this is a deliberate UX choice (badge shows +1, backend
 * receives +213), not a bug.
 */
export type DialPrefix = {
  display: string;
  e164: string;
  minLocalDigits: number;
  maxLocalDigits: number;
  /** Validates the local digit string (leading 0 already stripped). */
  localPattern: RegExp;
};

export const DIAL_PREFIXES: readonly DialPrefix[] = [
  {
    display: "+33",
    e164: "+33",
    minLocalDigits: 10,
    maxLocalDigits: 10,
    // French mobile: 06 or 07 + 8 digits.
    localPattern: /^[67]\d{8}$/,
  },
  {
    display: "+1",
    e164: "+213",
    minLocalDigits: 9,
    maxLocalDigits: 10,
    // Algerian mobile: 9 digits starting with 5, 6, or 7.
    localPattern: /^[567]\d{8}$/,
  },
] as const;

/** Strip non-digits and drop a leading 0 (French local form like 06...). */
export function localDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("0") ? d.slice(1) : d;
}

/** Build the E.164 number from the selected prefix + local input. */
export function buildE164(prefix: DialPrefix, raw: string): string | null {
  const digits = localDigits(raw);
  if (
    digits.length < prefix.minLocalDigits ||
    digits.length > prefix.maxLocalDigits
  ) {
    return null;
  }
  if (!prefix.localPattern.test(digits)) return null;
  return `${prefix.e164}${digits}`;
}

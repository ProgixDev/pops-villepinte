const FRENCH_MOBILE = /^(?:\+33|0033|0)([67]\d{8})$/;
// Algerian mobile: 9 digits starting with 5, 6, or 7. Accept the E.164
// (+213/00213) and bare local (without leading 0) forms.
const ALGERIAN_MOBILE = /^(?:\+213|00213)?([567]\d{8})$/;

export function normalizeFrenchMobile(input: string): string | null {
  const cleaned = input.replace(/\s|[-.]/g, '');
  const match = cleaned.match(FRENCH_MOBILE);
  if (!match) return null;
  return `+33${match[1]}`;
}

export function isFrenchMobile(input: string): boolean {
  return normalizeFrenchMobile(input) !== null;
}

/**
 * Normalize any supported mobile to E.164. Currently handles French
 * (+33[67]\d{8}) and Algerian (+213[567]\d{8}) mobiles. Returns null if
 * neither matches.
 */
export function normalizeMobile(input: string): string | null {
  const cleaned = input.replace(/\s|[-.]/g, '');
  const fr = cleaned.match(FRENCH_MOBILE);
  if (fr) return `+33${fr[1]}`;
  const dz = cleaned.match(ALGERIAN_MOBILE);
  if (dz) return `+213${dz[1]}`;
  return null;
}

export function isSupportedMobile(input: string): boolean {
  return normalizeMobile(input) !== null;
}

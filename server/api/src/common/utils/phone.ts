const FRENCH_MOBILE = /^(?:\+33|0033|0)([67]\d{8})$/;

export function normalizeFrenchMobile(input: string): string | null {
  const cleaned = input.replace(/\s|[-.]/g, '');
  const match = cleaned.match(FRENCH_MOBILE);
  if (!match) return null;
  return `+33${match[1]}`;
}

export function isFrenchMobile(input: string): boolean {
  return normalizeFrenchMobile(input) !== null;
}

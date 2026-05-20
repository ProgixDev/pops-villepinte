export type LoyaltyTier = 'BIENVENUE' | 'HABITUE' | 'VIP' | 'LEGENDE';

const TIERS: { tier: LoyaltyTier; min: number; max: number }[] = [
  { tier: 'BIENVENUE', min: 0, max: 4 },
  { tier: 'HABITUE', min: 5, max: 19 },
  { tier: 'VIP', min: 20, max: 49 },
  { tier: 'LEGENDE', min: 50, max: Number.MAX_SAFE_INTEGER },
];

export function loyaltyTier(orderCount: number): LoyaltyTier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (orderCount >= TIERS[i].min) return TIERS[i].tier;
  }
  return 'BIENVENUE';
}

/** Returns the order_count range that maps to a given tier (inclusive). */
export function tierRange(tier: LoyaltyTier): { min: number; max: number } {
  const found = TIERS.find((t) => t.tier === tier);
  // Defensive fallback; the type system makes this unreachable.
  return found ?? { min: 0, max: Number.MAX_SAFE_INTEGER };
}

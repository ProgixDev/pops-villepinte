/**
 * Loyalty tier ladder. Mirrors `server/api/src/common/utils/loyalty.ts` so both
 * sides agree on thresholds.
 */

export type LoyaltyTier = "BIENVENUE" | "HABITUE" | "VIP" | "LEGENDE";

const TIER_THRESHOLDS: { tier: LoyaltyTier; min: number }[] = [
  { tier: "LEGENDE", min: 50 },
  { tier: "VIP", min: 20 },
  { tier: "HABITUE", min: 5 },
  { tier: "BIENVENUE", min: 0 },
];

export function loyaltyTier(orderCount: number): LoyaltyTier {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (orderCount >= min) return tier;
  }
  return "BIENVENUE";
}

/** Friendly French copy shown on the profile/home card. */
export function loyaltyMessage(orderCount: number, displayName: string): string {
  const tier = loyaltyTier(orderCount);
  switch (tier) {
    case "BIENVENUE":
      return "Premier passage ? Bienvenue dans la famille Pop's.";
    case "HABITUE":
      return `Bienvenue chez nous, ${displayName}. On te reconnait deja.`;
    case "VIP":
      return "Tu fais partie des habitues. On garde ta place au chaud.";
    case "LEGENDE":
      return `Legende vivante. Respect, ${displayName}.`;
  }
}

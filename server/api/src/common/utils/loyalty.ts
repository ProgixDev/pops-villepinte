import type { SupabaseClient } from '@supabase/supabase-js';

export type LoyaltyTier = 'BIENVENUE' | 'HABITUE' | 'VIP' | 'LEGENDE';

export type LoyaltySettings = {
  habitue_min: number;
  vip_min: number;
  legende_min: number;
};

const DEFAULTS: LoyaltySettings = {
  habitue_min: 5,
  vip_min: 20,
  legende_min: 50,
};

// In-process cache. Cheap, single-instance API → re-fetching on every order
// status flip is wasteful. The admin endpoint clears this on save.
let cached: LoyaltySettings | null = null;

export function invalidateLoyaltyCache() {
  cached = null;
}

export async function getLoyaltySettings(
  supabase: SupabaseClient,
): Promise<LoyaltySettings> {
  if (cached) return cached;
  const { data } = await supabase
    .from('loyalty_settings')
    .select('habitue_min, vip_min, legende_min')
    .eq('id', 1)
    .maybeSingle();
  cached = data
    ? {
        habitue_min: Number(data.habitue_min),
        vip_min: Number(data.vip_min),
        legende_min: Number(data.legende_min),
      }
    : { ...DEFAULTS };
  return cached;
}

export function loyaltyTierFor(
  orderCount: number,
  s: LoyaltySettings,
): LoyaltyTier {
  if (orderCount >= s.legende_min) return 'LEGENDE';
  if (orderCount >= s.vip_min) return 'VIP';
  if (orderCount >= s.habitue_min) return 'HABITUE';
  return 'BIENVENUE';
}

/** Synchronous fallback that uses the cached values (or defaults). For paths
 * that ran getLoyaltySettings earlier in the request OR don't have async
 * access (rare). Always prefer the async accessor at the source. */
export function loyaltyTier(orderCount: number): LoyaltyTier {
  return loyaltyTierFor(orderCount, cached ?? DEFAULTS);
}

export function tierRange(
  tier: LoyaltyTier,
  s: LoyaltySettings = cached ?? DEFAULTS,
): { min: number; max: number } {
  switch (tier) {
    case 'BIENVENUE':
      return { min: 0, max: s.habitue_min - 1 };
    case 'HABITUE':
      return { min: s.habitue_min, max: s.vip_min - 1 };
    case 'VIP':
      return { min: s.vip_min, max: s.legende_min - 1 };
    case 'LEGENDE':
      return { min: s.legende_min, max: Number.MAX_SAFE_INTEGER };
  }
}

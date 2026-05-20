import { randomBytes } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export type PhoneSessionResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id?: string; phone?: string };
};

/**
 * Provision a Supabase auth user by phone (creating it if missing), reset its
 * password to a fresh random value, and return a signed-in session. Used by
 * any auth flow that has externally verified a phone number (Prelude in prod,
 * the dev OTP bypass in dev).
 *
 * Lookup is O(1) via the indexed `public.profiles.phone` column; if a profile
 * row is missing we fall back to creating a fresh auth user. The
 * `handle_new_user` trigger then backfills the profile.
 */
export async function provisionAndSignInByPhone(
  admin: SupabaseClient,
  anon: SupabaseClient,
  phoneE164: string,
): Promise<PhoneSessionResponse> {
  const password = randomBytes(24).toString('hex');
  const existing = await findAuthUserByPhone(admin, phoneE164);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      phone_confirm: true,
    });
    if (error) throw error;
  } else {
    const { error } = await admin.auth.admin.createUser({
      phone: phoneE164,
      password,
      phone_confirm: true,
    });
    if (error) throw error;
  }

  const { data, error } = await anon.auth.signInWithPassword({
    phone: phoneE164,
    password,
  });
  if (error || !data.session) {
    throw new UnauthorizedException(
      error?.message ?? 'Failed to mint session',
    );
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: { id: data.user?.id, phone: data.user?.phone },
  };
}

async function findAuthUserByPhone(
  admin: SupabaseClient,
  phoneE164: string,
): Promise<User | null> {
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .eq('phone', phoneE164)
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (!profile) return null;

  const { data, error } = await admin.auth.admin.getUserById(profile.id);
  if (error) throw error;
  return data.user ?? null;
}

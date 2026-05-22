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
 * password to a fresh random value, and return a signed-in session. Called by
 * the Prelude verification flow once the phone number has been confirmed.
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
  // Supabase strips the leading "+" when storing auth.users.phone, and the
  // handle_new_user trigger copies that value into profiles.phone — so the
  // stored form is digits-only ("33612345678"). Match both formats to be safe
  // against any legacy rows that kept the "+".
  const phoneNoPlus = phoneE164.startsWith('+')
    ? phoneE164.slice(1)
    : phoneE164;

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .in('phone', [phoneNoPlus, phoneE164])
    .maybeSingle();
  if (profileErr) throw profileErr;

  if (profile) {
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error) throw error;
    if (data.user) return data.user;
  }

  // Fallback: an auth user can exist without a profile row if handle_new_user
  // ever failed. Without this check we'd try to createUser() and Supabase
  // would 409 with "Phone number already registered by another user".
  // PostgREST only exposes `public`/`graphql_public` by default, so a hosted
  // project without the auth schema added to "Exposed schemas" returns
  // PGRST106 here. Treat that as "no orphan" so first-time sign-in still
  // works; on conflict the createUser call surfaces the real error.
  const { data: orphan, error: orphanErr } = await admin
    .schema('auth')
    .from('users')
    .select('id')
    .eq('phone', phoneNoPlus)
    .maybeSingle();
  if (orphanErr) {
    if ((orphanErr as { code?: string }).code === 'PGRST106') return null;
    throw orphanErr;
  }
  if (!orphan) return null;

  await admin
    .from('profiles')
    .upsert({ id: orphan.id, phone: phoneNoPlus }, { onConflict: 'id' });

  const { data, error } = await admin.auth.admin.getUserById(orphan.id);
  if (error) throw error;
  return data.user ?? null;
}

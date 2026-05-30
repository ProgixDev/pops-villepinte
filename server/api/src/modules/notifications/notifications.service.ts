import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase.module';
import {
  getLoyaltySettings,
  loyaltyTierFor,
} from '../../common/utils/loyalty';
import { isExpoPushToken, sendExpoPush } from './expo-push';

export type NotifyAudience =
  | { kind: 'user'; userIds: string[] }
  | { kind: 'tier'; tiers: ('BIENVENUE' | 'HABITUE' | 'VIP' | 'LEGENDE')[] }
  | { kind: 'all' }
  | { kind: 'drivers' };

export type NotifyPayload = {
  title: string;
  body: string;
  notificationKind: 'order' | 'broadcast';
  orderId?: string;
  data?: Record<string, unknown>;
  // Device notification category → enables action buttons (e.g. the driver
  // assignment Accepter/Refuser buttons). Only affects the OS push, not the
  // in-app row.
  categoryId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
  ) {}

  /** Resolve user ids for a given audience. */
  private async resolveUserIds(audience: NotifyAudience): Promise<string[]> {
    if (audience.kind === 'user') return audience.userIds;

    // Drivers are a distinct role — notify every non-blocked driver.
    if (audience.kind === 'drivers') {
      const { data: drivers, error: dErr } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('role', 'driver')
        .eq('is_blocked', false);
      if (dErr) throw dErr;
      return (drivers ?? []).map((d) => d.id);
    }

    const { data: profiles, error } = await this.supabase
      .from('profiles')
      .select('id, order_count')
      .eq('role', 'customer')
      .eq('is_blocked', false);
    if (error) throw error;

    if (audience.kind === 'all') return (profiles ?? []).map((p) => p.id);

    const settings = await getLoyaltySettings(this.supabase);
    const tiers = new Set(audience.tiers);
    return (profiles ?? [])
      .filter((p) => tiers.has(loyaltyTierFor(p.order_count, settings)))
      .map((p) => p.id);
  }

  /** Persist a notification row per recipient + push to all their devices. */
  async notify(
    audience: NotifyAudience,
    payload: NotifyPayload,
  ): Promise<{ recipients: number; pushed: number }> {
    const userIds = await this.resolveUserIds(audience);
    if (userIds.length === 0) return { recipients: 0, pushed: 0 };

    const rows = userIds.map((user_id) => ({
      user_id,
      kind: payload.notificationKind,
      title: payload.title,
      body: payload.body,
      order_id: payload.orderId ?? null,
      data: payload.data ?? {},
    }));
    const { error: insertError } = await this.supabase
      .from('notifications')
      .insert(rows);
    if (insertError) throw insertError;

    // Send pushes — fetch tokens for these users from BOTH stores:
    //  - device_tokens: where customers register (one row per device)
    //  - profiles.expo_push_token: where drivers register (one per driver)
    // Drivers never write to device_tokens, so without this their assignment
    // pushes silently never go out.
    const [{ data: tokens }, { data: profileTokens }] = await Promise.all([
      this.supabase
        .from('device_tokens')
        .select('token, user_id')
        .in('user_id', userIds),
      this.supabase
        .from('profiles')
        .select('expo_push_token')
        .in('id', userIds)
        .not('expo_push_token', 'is', null),
    ]);

    const validTokens = Array.from(
      new Set(
        [
          ...(tokens ?? []).map((t) => t.token),
          ...(profileTokens ?? []).map(
            (p) => p.expo_push_token as string | null,
          ),
        ].filter(
          (tok): tok is string => !!tok && isExpoPushToken(tok),
        ),
      ),
    );

    if (validTokens.length === 0) {
      return { recipients: userIds.length, pushed: 0 };
    }

    const messages = validTokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: 'default' as const,
      // Carries the Accepter/Refuser action buttons when set (driver assignment).
      ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
      // payload.data spread LAST so an explicit data.kind (e.g.
      // 'driver-assignment') and assignmentId survive — the tap handler in the
      // app routes on data.kind, and notificationKind would otherwise clobber it.
      data: {
        kind: payload.notificationKind,
        orderId: payload.orderId,
        ...payload.data,
      },
    }));
    const result = await sendExpoPush(messages);

    // Prune tokens that Expo says are dead — from both stores.
    if (result.invalidTokens.length > 0) {
      await Promise.all([
        this.supabase
          .from('device_tokens')
          .delete()
          .in('token', result.invalidTokens),
        this.supabase
          .from('profiles')
          .update({ expo_push_token: null })
          .in('expo_push_token', result.invalidTokens),
      ]);
    }

    return {
      recipients: userIds.length,
      pushed: validTokens.length - result.invalidTokens.length,
    };
  }

  // ── Customer-facing endpoints ────────────────────────────────────────────
  async listForUser(userId: string, limit = 30) {
    const { data, error } = await this.supabase
      .from('notifications')
      .select('id, kind, title, body, order_id, data, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async unreadCountForUser(userId: string) {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
    return count ?? 0;
  }

  async markRead(userId: string, id: string) {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async markAllRead(userId: string) {
    const { error } = await this.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw error;
    return { ok: true };
  }

  // ── Device token endpoints ──────────────────────────────────────────────
  async registerToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ) {
    if (!isExpoPushToken(token)) {
      throw new BadRequestException('Expo push token attendu');
    }
    const { error } = await this.supabase
      .from('device_tokens')
      .upsert(
        {
          token,
          user_id: userId,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      );
    if (error) throw error;
    return { ok: true };
  }

  async unregisterToken(userId: string, token: string) {
    const { error } = await this.supabase
      .from('device_tokens')
      .delete()
      .eq('token', token)
      .eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  }
}

/**
 * Tiny Expo Push API wrapper. We only need the "send" half — receipts can be
 * polled later if delivery becomes a concern. No SDK dependency: a fetch call
 * is enough and keeps the bundle lean.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type ExpoPushMessage = {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  badge?: number;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

export type ExpoPushResult = {
  ok: boolean;
  invalidTokens: string[];
  raw?: ExpoTicket[];
};

const looksLikeExpoToken = (t: string) =>
  t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');

export async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<ExpoPushResult> {
  if (messages.length === 0) {
    return { ok: true, invalidTokens: [] };
  }

  // Expo accepts up to 100 messages per batch. Chunk defensively.
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const invalidTokens: string[] = [];
  const tickets: ExpoTicket[] = [];

  for (const chunk of chunks) {
    // Default every message to high priority + the HIGH-importance 'default'
    // Android channel the apps register (see lib/push.ts). Without high priority,
    // Android holds notifications in Doze while the phone is locked/idle and only
    // flushes them at the next maintenance window — minutes later, or never until
    // the screen turns on. That was the "driver gets the course a minute late, or
    // only sees the in-app notif because the phone was closed" bug. channelId
    // selects the heads-up + sound channel on Android 8+. Per-message values still
    // win (spread last) for any future caller that wants different behavior.
    const payload: ExpoPushMessage[] = chunk.map((m) => ({
      priority: 'high',
      channelId: 'default',
      ...m,
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: ExpoTicket | ExpoTicket[] };
      const data = Array.isArray(body.data)
        ? body.data
        : body.data
          ? [body.data]
          : [];
      tickets.push(...data);

      data.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          const code = ticket.details?.error;
          if (
            code === 'DeviceNotRegistered' ||
            code === 'InvalidCredentials'
          ) {
            const msg = chunk[idx];
            const targets = Array.isArray(msg.to) ? msg.to : [msg.to];
            invalidTokens.push(...targets);
          }
        }
      });
    } catch {
      // Network/JSON errors are non-fatal — push is best effort.
    }
  }

  return { ok: true, invalidTokens, raw: tickets };
}

export function isExpoPushToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && looksLikeExpoToken(token);
}

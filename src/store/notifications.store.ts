import { create } from "zustand";

import { notificationsApi, type NotificationData } from "@/lib/api";

type NotificationsState = {
  items: NotificationData[];
  unread: number;
  loading: boolean;
  fetch: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Optimistically prepend a freshly-received push so the list is never blank. */
  prepend: (n: NotificationData) => void;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const items = await notificationsApi.list(50);
      const unread = items.filter((n) => n.read_at === null).length;
      set({ items, unread, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  refreshUnread: async () => {
    try {
      const unread = await notificationsApi.unreadCount();
      set({ unread });
    } catch {
      // ignore — badge is best-effort
    }
  },

  markRead: async (id) => {
    // Optimistic
    set((s) => ({
      items: s.items.map((n) =>
        n.id === id && n.read_at === null
          ? { ...n, read_at: new Date().toISOString() }
          : n,
      ),
      unread: Math.max(0, s.unread - (get().items.find((n) => n.id === id && n.read_at === null) ? 1 : 0)),
    }));
    try {
      await notificationsApi.markRead(id);
    } catch {
      // Reconcile if it failed
      void get().fetch();
    }
  },

  markAllRead: async () => {
    set((s) => ({
      items: s.items.map((n) =>
        n.read_at ? n : { ...n, read_at: new Date().toISOString() },
      ),
      unread: 0,
    }));
    try {
      await notificationsApi.markAllRead();
    } catch {
      void get().fetch();
    }
  },

  prepend: (n) =>
    set((s) => ({
      items: [n, ...s.items.filter((x) => x.id !== n.id)],
      unread: s.unread + (n.read_at === null ? 1 : 0),
    })),
}));

-- =============================================================================
-- POP'S Villepinte — configurable loyalty thresholds + notification system
-- =============================================================================

-- ── loyalty_settings ────────────────────────────────────────────────────────
-- Single-row table, id=1. Edited from the super-admin loyalty page.
create table public.loyalty_settings (
  id integer primary key check (id = 1),
  habitue_min integer not null default 5  check (habitue_min  > 0),
  vip_min     integer not null default 20 check (vip_min      > habitue_min),
  legende_min integer not null default 50 check (legende_min  > vip_min),
  updated_at  timestamptz not null default now()
);

insert into public.loyalty_settings (id) values (1);

alter table public.loyalty_settings enable row level security;

create policy loyalty_settings_public_read on public.loyalty_settings
  for select using (true);

-- writes go through the service-role client (admin endpoint)

-- ── device_tokens ───────────────────────────────────────────────────────────
-- Expo push tokens, one row per device. A user can own several.
create table public.device_tokens (
  token       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    text not null check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

create policy device_tokens_owner_select on public.device_tokens
  for select using (auth.uid() = user_id or public.current_user_is_admin());

create policy device_tokens_owner_upsert on public.device_tokens
  for insert with check (auth.uid() = user_id);

create policy device_tokens_owner_update on public.device_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy device_tokens_owner_delete on public.device_tokens
  for delete using (auth.uid() = user_id);

-- ── notifications ──────────────────────────────────────────────────────────
-- Two flavours:
--   kind='order'     → linked to one user_id + order_id
--   kind='broadcast' → linked to one user_id (one row per recipient even for
--                      blast campaigns, so the unread badge is per-user)
create type public.notification_kind as enum ('order', 'broadcast');

create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null,
  body        text not null,
  order_id    text references public.orders(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications(user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_owner_select on public.notifications
  for select using (auth.uid() = user_id or public.current_user_is_admin());

create policy notifications_owner_update on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- writes happen via the service-role client in the API

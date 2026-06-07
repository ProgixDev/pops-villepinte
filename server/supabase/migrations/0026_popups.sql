-- =============================================================================
-- POP'S Villepinte — opening pop-ups (posters)
-- Admin uploads promotional posters in the superadmin. On opening the mobile
-- home screen, a client is shown each eligible, not-seen-today poster one at a
-- time (tap X to advance). Posters can be targeted at loyalty tiers.
-- =============================================================================

create table public.app_popups (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default '',
  image_url     text not null,
  -- Empty array = shown to everyone. Otherwise the poster is only shown to
  -- clients whose loyalty tier is in this list (BIENVENUE/HABITUE/VIP/LEGENDE).
  target_tiers  text[] not null default '{}',
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint app_popups_tiers_valid check (
    target_tiers <@ array['BIENVENUE','HABITUE','VIP','LEGENDE']::text[]
  )
);

create index app_popups_sort_idx
  on public.app_popups(sort_order)
  where is_active;

alter table public.app_popups enable row level security;

-- Public read: anyone (anon + authenticated) sees active posters. Tier
-- filtering happens in the API read endpoint, not via RLS.
create policy app_popups_public_read on public.app_popups
  for select using (is_active);

-- Writes go through the service-role client in the API; no INSERT/UPDATE/DELETE
-- policies for anon/authenticated.

-- =============================================================================
-- Storage bucket for poster images (public read, admin write)
-- Mirrors the accompagnements bucket setup (migration 0006).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('popups', 'popups', true)
on conflict (id) do nothing;

create policy "popups public read"
  on storage.objects for select
  using (bucket_id = 'popups');

create policy "popups admin write"
  on storage.objects for insert
  with check (
    bucket_id = 'popups' and public.current_user_is_admin()
  );

create policy "popups admin update"
  on storage.objects for update
  using (
    bucket_id = 'popups' and public.current_user_is_admin()
  )
  with check (
    bucket_id = 'popups' and public.current_user_is_admin()
  );

create policy "popups admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'popups' and public.current_user_is_admin()
  );

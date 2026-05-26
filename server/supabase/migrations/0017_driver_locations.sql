-- =============================================================================
-- Live driver location for in-flight deliveries.
-- One row per driver — upserted on each location ping from the driver app.
-- Customer can SELECT only while they have an accepted, undelivered
-- assignment with that driver (RLS does the gating; no app-layer filter).
-- =============================================================================

create table if not exists public.driver_locations (
  driver_id   uuid primary key references public.profiles(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  -- 0..360, null when the device can't determine heading (e.g. stationary).
  heading     numeric(5, 2),
  speed_kmh   numeric(5, 2),
  updated_at  timestamptz not null default now()
);

create index if not exists driver_locations_updated_idx
  on public.driver_locations(updated_at desc);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.driver_locations enable row level security;

-- Driver may upsert (and read) their own row.
drop policy if exists driver_locations_self_write on public.driver_locations;
create policy driver_locations_self_write on public.driver_locations
  for all
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

-- Customer can SELECT the location of any driver currently delivering one of
-- their orders. The exists() walks order_assignments → orders to confirm
-- ownership and that the delivery is in-flight (accepted + no delivered_at).
-- Auto-revokes the moment delivered_at is set or the assignment is cancelled.
drop policy if exists driver_locations_assigned_customer_select on public.driver_locations;
create policy driver_locations_assigned_customer_select on public.driver_locations
  for select using (
    exists (
      select 1
      from public.order_assignments oa
      join public.orders o on o.id = oa.order_id
      where oa.driver_id = driver_locations.driver_id
        and oa.status = 'accepted'
        and oa.delivered_at is null
        and o.user_id = auth.uid()
    )
  );

-- Admin full control (for the superadmin live-ops view down the line).
drop policy if exists driver_locations_admin_all on public.driver_locations;
create policy driver_locations_admin_all on public.driver_locations
  for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- =============================================================================
-- Realtime
-- =============================================================================
-- Add to the supabase_realtime publication so customer clients can subscribe
-- via postgres_changes. The replication filter still respects RLS, so the
-- customer only receives events for the driver they're authorized to see.

alter publication supabase_realtime add table public.driver_locations;

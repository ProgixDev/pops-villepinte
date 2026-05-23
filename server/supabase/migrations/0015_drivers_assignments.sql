-- =============================================================================
-- Drivers + order assignments
-- =============================================================================

-- Extend app_role enum with 'driver'
alter type public.app_role add value if not exists 'driver';

-- Driver-specific profile fields (nullable for non-drivers).
alter table public.profiles
  add column if not exists expo_push_token text,
  add column if not exists vehicle text,
  add column if not exists license_plate text,
  add column if not exists is_active boolean not null default true;

create index if not exists profiles_role_idx on public.profiles(role);

-- =============================================================================
-- order_assignments
-- One row per (order, driver, attempt). Super admin assigns; driver responds.
-- =============================================================================

do $$ begin
  create type public.assignment_status as enum (
    'pending',    -- sent to driver, awaiting response
    'accepted',   -- driver accepted
    'refused',    -- driver refused
    'cancelled'   -- admin cancelled the assignment
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.order_assignments (
  id uuid primary key default uuid_generate_v4(),
  order_id text not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  status public.assignment_status not null default 'pending',
  note text,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  responded_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz
);

create index if not exists order_assignments_order_idx
  on public.order_assignments(order_id);
create index if not exists order_assignments_driver_idx
  on public.order_assignments(driver_id, assigned_at desc);
create index if not exists order_assignments_active_idx
  on public.order_assignments(driver_id)
  where status in ('pending','accepted');

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.order_assignments enable row level security;

-- Driver sees their own assignments; admin sees all.
drop policy if exists order_assignments_driver_select on public.order_assignments;
create policy order_assignments_driver_select on public.order_assignments
  for select using (
    auth.uid() = driver_id or public.current_user_is_admin()
  );

-- Driver may respond (accept/refuse + note) only on their own pending row.
drop policy if exists order_assignments_driver_update on public.order_assignments;
create policy order_assignments_driver_update on public.order_assignments
  for update
  using (auth.uid() = driver_id and status = 'pending')
  with check (
    auth.uid() = driver_id
    and status in ('accepted','refused')
  );

-- Admin full control.
drop policy if exists order_assignments_admin_all on public.order_assignments;
create policy order_assignments_admin_all on public.order_assignments
  for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

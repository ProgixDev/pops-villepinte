-- Customer-rates-driver after a delivery is completed. One rating per
-- assignment. Writes go through the API (service role), but RLS is kept tight
-- for defense-in-depth and any future direct-client/realtime access.

create table if not exists public.driver_ratings (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique
                  references public.order_assignments(id) on delete cascade,
  order_id      text not null references public.orders(id) on delete cascade,
  driver_id     uuid not null references public.profiles(id) on delete cascade,
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  stars         int  not null check (stars between 1 and 5),
  feedback      text,
  created_at    timestamptz not null default now()
);

create index if not exists driver_ratings_driver_idx
  on public.driver_ratings(driver_id, created_at desc);

alter table public.driver_ratings enable row level security;

-- Customer manages their own rating.
drop policy if exists driver_ratings_customer on public.driver_ratings;
create policy driver_ratings_customer on public.driver_ratings
  for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- Driver can read ratings about themselves.
drop policy if exists driver_ratings_driver_read on public.driver_ratings;
create policy driver_ratings_driver_read on public.driver_ratings
  for select using (auth.uid() = driver_id);

-- Admin full access.
drop policy if exists driver_ratings_admin on public.driver_ratings;
create policy driver_ratings_admin on public.driver_ratings
  for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

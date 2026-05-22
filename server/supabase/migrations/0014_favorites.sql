-- =============================================================================
-- POP'S Villepinte — favorites
-- =============================================================================
-- Per-user favorited products. Cross-device truth lives here; the mobile
-- client mirrors this into a persisted zustand store for instant render.

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index favorites_user_created_idx
  on public.favorites(user_id, created_at desc);

alter table public.favorites enable row level security;

create policy "favorites_select_own"
  on public.favorites
  for select
  using (auth.uid() = user_id);

create policy "favorites_insert_own"
  on public.favorites
  for insert
  with check (auth.uid() = user_id);

create policy "favorites_delete_own"
  on public.favorites
  for delete
  using (auth.uid() = user_id);

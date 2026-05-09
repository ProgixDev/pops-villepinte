-- =============================================================================
-- POP'S Villepinte — home signature carousel
-- Up to 3 products featured on the mobile home screen hero.
-- =============================================================================

create table public.home_signatures (
  product_id text primary key references public.products(id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint home_signatures_position_range check (position between 0 and 2),
  constraint home_signatures_position_unique unique (position)
);

create index home_signatures_position_idx on public.home_signatures(position);

alter table public.home_signatures enable row level security;

-- Public read: anyone can see the active signatures (only when underlying
-- product is still available — joined client-side in the API layer).
create policy home_signatures_public_read on public.home_signatures
  for select using (true);

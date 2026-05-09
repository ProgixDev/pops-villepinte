-- =============================================================================
-- POP'S Villepinte — cart "Notre conseil" suggestions
-- Up to 6 products curated by admin to surface in the cart suggestion strip.
-- =============================================================================

create table public.home_advice (
  product_id text primary key references public.products(id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint home_advice_position_range check (position between 0 and 5),
  constraint home_advice_position_unique unique (position)
);

create index home_advice_position_idx on public.home_advice(position);

alter table public.home_advice enable row level security;

-- Public read: anyone can see the curated advice products (filtered against
-- product availability in the API layer).
create policy home_advice_public_read on public.home_advice
  for select using (true);

-- =============================================================================
-- POP'S Villepinte — shop public-facing settings
-- Single-row table holding the opening days/hours strings displayed in the
-- mobile app's profile "Informations" section. Admin updates them; clients
-- read them.
-- =============================================================================

create table public.shop_settings (
  id integer primary key check (id = 1),
  open_days text not null default 'Lundi - Dimanche',
  open_hours text not null default '11h - 00h',
  updated_at timestamptz not null default now()
);

insert into public.shop_settings (id) values (1);

alter table public.shop_settings enable row level security;

create policy shop_settings_public_read on public.shop_settings
  for select using (true);

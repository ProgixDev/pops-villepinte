-- Home CMS upgrades:
--  1. Unlimited signature products (was capped at 3 via position 0..2 + unique).
--  2. Persist the bandeau (marquee) + bloc (story) text, previously hardcoded
--     in the mobile app / unsaved in the admin.

-- 1) Relax the signature position constraints so any number can be featured.
alter table public.home_signatures
  drop constraint if exists home_signatures_position_range;
alter table public.home_signatures
  drop constraint if exists home_signatures_position_unique;

-- 2) Single-row editable home content (marquee + story). Public-readable.
create table if not exists public.home_content (
  id            integer primary key check (id = 1),
  marquee_text  text not null default 'FAIT MAISON 🔥   SMASH BURGERS   TACOS   BOWLS   WRAPS   DU PEUPLE POUR LE PEUPLE 💛   VILLEPINTE 93   VIENS RÉCUPÉRER   CASH OU CB',
  story_title   text not null default 'POP''S VILLEPINTE',
  story_body    text not null default 'Abdoullah en cuisine, fait maison chaque jour. Smash burgers, bowls, tacos — du peuple, pour le peuple.',
  updated_at    timestamptz not null default now()
);

insert into public.home_content (id) values (1)
  on conflict (id) do nothing;

alter table public.home_content enable row level security;

drop policy if exists home_content_public_read on public.home_content;
create policy home_content_public_read on public.home_content
  for select using (true);

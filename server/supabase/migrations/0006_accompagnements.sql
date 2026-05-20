-- =============================================================================
-- POP'S Villepinte — accompagnements
-- Standalone drinks / sides catalogue managed by admin. Surfaced in the
-- mobile cart "Notre conseil" strip.
-- =============================================================================

create table public.accompagnements (
  id text primary key,
  name text not null,
  price_eur numeric(6,2) not null check (price_eur >= 0),
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accompagnements_sort_idx
  on public.accompagnements(sort_order)
  where is_active;

alter table public.accompagnements enable row level security;

-- Public read: anyone (anon + authenticated) sees active rows.
create policy accompagnements_public_read on public.accompagnements
  for select using (is_active);

-- Writes go through the service-role client in the API; no INSERT/UPDATE/DELETE
-- policies for anon/authenticated.

-- =============================================================================
-- Storage bucket for accompagnement images (public read)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('accompagnements', 'accompagnements', true)
on conflict (id) do nothing;

create policy "accompagnements public read"
  on storage.objects for select
  using (bucket_id = 'accompagnements');

-- Authenticated admins may upload / replace / remove accompagnement images
-- directly from the superadmin browser. Uses the same admin helper that the
-- catalogue RLS policies rely on.
create policy "accompagnements admin write"
  on storage.objects for insert
  with check (
    bucket_id = 'accompagnements' and public.current_user_is_admin()
  );

create policy "accompagnements admin update"
  on storage.objects for update
  using (
    bucket_id = 'accompagnements' and public.current_user_is_admin()
  )
  with check (
    bucket_id = 'accompagnements' and public.current_user_is_admin()
  );

create policy "accompagnements admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'accompagnements' and public.current_user_is_admin()
  );

-- Also allow admin uploads to the existing product-images bucket so the
-- product editor can upload artwork the same way (currently only readable).
create policy "product-images admin write"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images' and public.current_user_is_admin()
  );

create policy "product-images admin update"
  on storage.objects for update
  using (
    bucket_id = 'product-images' and public.current_user_is_admin()
  )
  with check (
    bucket_id = 'product-images' and public.current_user_is_admin()
  );

create policy "product-images admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images' and public.current_user_is_admin()
  );

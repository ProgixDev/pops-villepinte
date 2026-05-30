-- Image attachments on problem reports ("Signaler un problème"). The customer
-- can attach photos of the issue (wrong/missing item, damaged packaging…) from
-- the mobile app. Files are uploaded directly from the authenticated app to the
-- `ticket-attachments` bucket; only the resulting public URLs are stored here.

alter table public.delivery_tickets
  add column if not exists image_urls text[] not null default '{}';

-- =============================================================================
-- Storage bucket for ticket attachments (public read)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

-- Anyone can read (the superadmin renders the thumbnails, and public URLs keep
-- the admin client simple). The path is an unguessable timestamped key.
drop policy if exists "ticket-attachments public read" on storage.objects;
create policy "ticket-attachments public read"
  on storage.objects for select
  using (bucket_id = 'ticket-attachments');

-- An authenticated user (customer or driver) may upload, but only inside their
-- own user-id folder — the app uploads to `<auth.uid>/<file>`. This stops one
-- user from writing into another's folder while keeping the policy simple.
drop policy if exists "ticket-attachments owner write" on storage.objects;
create policy "ticket-attachments owner write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins may clean up any attachment.
drop policy if exists "ticket-attachments admin delete" on storage.objects;
create policy "ticket-attachments admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'ticket-attachments' and public.current_user_is_admin()
  );

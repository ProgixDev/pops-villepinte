-- Enable Supabase Realtime for the notifications table so the mobile client
-- gets new rows pushed instantly via the websocket subscription. RLS on the
-- table already restricts reads to the row's owner.
-- Idempotent: re-running on a DB where the table is already published would
-- otherwise fail with 42710 (already a member of the publication).
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- Enable Supabase Realtime for the notifications table so the mobile client
-- gets new rows pushed instantly via the websocket subscription. RLS on the
-- table already restricts reads to the row's owner.
alter publication supabase_realtime add table public.notifications;

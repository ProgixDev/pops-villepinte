-- Enable Supabase Realtime for order_assignments so the driver app gets new
-- assignments pushed instantly over the websocket — without waiting on the OS
-- push or a manual refresh. The existing RLS select policy
-- (order_assignments_driver_select) already restricts inbound rows to the
-- assigned driver (auth.uid() = driver_id) or admins, so realtime delivery is
-- scoped automatically.
alter publication supabase_realtime add table public.order_assignments;

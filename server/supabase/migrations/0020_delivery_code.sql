-- QR handoff confirmation. A per-order secret the customer shows as a QR; the
-- driver scans it to confirm delivery. It lives on the ORDER and is only ever
-- exposed to the customer (never to the driver app) — the driver proves
-- presence by scanning the customer's screen. Also record HOW a delivery was
-- confirmed so manual ("confirmer sans QR") fallbacks stay auditable.

alter table public.orders
  add column if not exists delivery_code text;

alter table public.order_assignments
  add column if not exists delivered_method text
    check (delivered_method in ('qr', 'manual'));

-- Backfill in-flight delivery orders so existing customers have a code to show.
update public.orders
  set delivery_code = upper(substr(md5(random()::text || id), 1, 10))
  where pickup_mode = 'delivery'
    and delivery_code is null
    and status in ('received', 'preparing', 'ready', 'handed_to_livreur');

-- Problem reports ("Signaler un problème") filed by a driver (blocks delivery —
-- e.g. client absent / QR illisible) or by a customer (post-delivery issue).
-- Surfaced to the superadmin for resolution.

create table if not exists public.delivery_tickets (
  id            uuid primary key default gen_random_uuid(),
  order_id      text not null references public.orders(id) on delete cascade,
  assignment_id uuid references public.order_assignments(id) on delete set null,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('driver', 'customer')),
  category      text not null,
  description   text,
  status        text not null default 'open'
                  check (status in ('open', 'resolved')),
  admin_notes   text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists delivery_tickets_status_idx
  on public.delivery_tickets(status, created_at desc);

alter table public.delivery_tickets enable row level security;

-- Reporter manages their own tickets.
drop policy if exists delivery_tickets_reporter on public.delivery_tickets;
create policy delivery_tickets_reporter on public.delivery_tickets
  for all
  using (auth.uid() = reporter_id)
  with check (auth.uid() = reporter_id);

-- Admin full access.
drop policy if exists delivery_tickets_admin on public.delivery_tickets;
create policy delivery_tickets_admin on public.delivery_tickets
  for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

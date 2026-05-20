-- =============================================================================
-- POP'S Villepinte — delivery option on orders
-- =============================================================================

create type public.pickup_mode as enum ('pickup', 'delivery');

alter table public.orders
  add column pickup_mode public.pickup_mode not null default 'pickup',
  add column delivery_address text,
  add column delivery_lat numeric(9, 6),
  add column delivery_lng numeric(9, 6),
  add column delivery_fee_eur numeric(6, 2) not null default 0
    check (delivery_fee_eur >= 0);

-- A delivery order must carry an address + coordinates; a pickup order must not.
alter table public.orders
  add constraint orders_pickup_mode_check
  check (
    (
      pickup_mode = 'delivery'
      and delivery_address is not null
      and delivery_lat is not null
      and delivery_lng is not null
    )
    or (
      pickup_mode = 'pickup'
      and delivery_address is null
      and delivery_lat is null
      and delivery_lng is null
      and delivery_fee_eur = 0
    )
  );

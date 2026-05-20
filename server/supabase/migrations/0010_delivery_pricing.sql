-- =============================================================================
-- POP'S Villepinte — configurable delivery pricing
-- Drops the fixed 8 km zone; fee is now base + per-km rate, both editable
-- from the super-admin panel.
-- =============================================================================

alter table public.shop_settings
  add column delivery_base_fee_eur numeric(6, 2) not null default 3.00
    check (delivery_base_fee_eur >= 0),
  add column delivery_per_km_eur numeric(6, 2) not null default 0.00
    check (delivery_per_km_eur >= 0);

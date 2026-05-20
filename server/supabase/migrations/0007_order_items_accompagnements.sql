-- =============================================================================
-- POP'S Villepinte — allow order_items to reference an accompagnement instead
-- of a product. Either product_id or accompagnement_id is set, never both.
-- =============================================================================

alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  add column accompagnement_id text
  references public.accompagnements(id) on delete restrict;

create index order_items_accompagnement_idx
  on public.order_items(accompagnement_id)
  where accompagnement_id is not null;

alter table public.order_items
  add constraint order_items_kind_check
  check (
    (product_id is not null and accompagnement_id is null)
    or (product_id is null and accompagnement_id is not null)
  );

-- Mirror the existing customer-insert policy for accompagnement-typed rows.
-- The original policy already passes because it only checks the parent order;
-- no change needed there.

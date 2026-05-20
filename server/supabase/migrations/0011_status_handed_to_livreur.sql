-- =============================================================================
-- POP'S Villepinte — new "handed to courier" status for delivery orders
-- Inserted between "ready" and "picked_up" only when pickup_mode='delivery'.
-- =============================================================================

alter type public.order_status add value if not exists 'handed_to_livreur' after 'ready';

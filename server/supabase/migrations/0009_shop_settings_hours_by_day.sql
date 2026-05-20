-- =============================================================================
-- POP'S Villepinte — per-day opening hours
-- Each key is mon/tue/wed/thu/fri/sat/sun, each value is { closed, open, close }.
-- =============================================================================

alter table public.shop_settings
  add column hours_by_day jsonb not null default '{
    "mon": {"closed": false, "open": "11:00", "close": "00:00"},
    "tue": {"closed": false, "open": "11:00", "close": "00:00"},
    "wed": {"closed": false, "open": "11:00", "close": "00:00"},
    "thu": {"closed": false, "open": "11:00", "close": "00:00"},
    "fri": {"closed": false, "open": "11:00", "close": "01:00"},
    "sat": {"closed": false, "open": "11:00", "close": "01:00"},
    "sun": {"closed": false, "open": "12:00", "close": "00:00"}
  }'::jsonb;

update public.shop_settings
   set hours_by_day = hours_by_day  -- ensures default applied to existing row
 where id = 1;

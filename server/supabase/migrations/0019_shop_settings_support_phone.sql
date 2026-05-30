-- Superadmin support contact shown to drivers ("Appeler le support" on the
-- assignment/delivery screens). Nullable — the driver app hides the call
-- button when it's empty. Public read is already covered by
-- shop_settings_public_read.
alter table public.shop_settings
  add column if not exists support_phone text;

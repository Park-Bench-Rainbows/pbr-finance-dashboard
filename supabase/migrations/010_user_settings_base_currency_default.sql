-- 010_user_settings_base_currency_default
-- Keep theme-only settings updates safe by ensuring new settings rows get a base currency.

alter table public.user_settings
  alter column base_currency set default 'TTD';


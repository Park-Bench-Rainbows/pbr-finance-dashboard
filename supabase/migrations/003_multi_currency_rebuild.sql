-- 003_multi_currency_rebuild
-- Rebuild multi-currency schema (data can be wiped)

create extension if not exists pgcrypto;

drop table if exists public.incomes cascade;
drop table if exists public.recurring_expenses cascade;
drop table if exists public.fx_rates cascade;
drop table if exists public.user_settings cascade;

-- user settings
create table public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- fx rates cache (quote_per_base)
create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  quote_currency text not null check (quote_currency in ('TTD','USD','CAD')),
  rate numeric(18,8) not null,
  as_of timestamptz not null,
  source text not null,
  created_at timestamptz not null default now()
);

create unique index fx_rates_pair_as_of_uq on public.fx_rates(base_currency, quote_currency, as_of);

-- incomes
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  original_currency text not null check (original_currency in ('TTD','USD','CAD')),
  original_amount_cents integer not null,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  base_amount_cents integer not null,
  fx_rate numeric(18,8) not null,
  fx_as_of timestamptz not null,
  fx_source text not null,
  frequency text not null check (frequency in ('monthly','biweekly')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incomes_user_id_idx on public.incomes(user_id);

-- recurring expenses
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  original_currency text not null check (original_currency in ('TTD','USD','CAD')),
  original_amount_cents integer not null,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  base_amount_cents integer not null,
  fx_rate numeric(18,8) not null,
  fx_as_of timestamptz not null,
  fx_source text not null,
  frequency text not null check (frequency in ('monthly','annual')),
  category text not null check (category in ('housing','utilities','subscriptions','insurance','transportation','other')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_expenses_user_id_idx on public.recurring_expenses(user_id);


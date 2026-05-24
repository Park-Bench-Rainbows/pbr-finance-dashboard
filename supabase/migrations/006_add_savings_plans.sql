-- 006_add_savings_plans

create extension if not exists pgcrypto;

create table if not exists public.savings_plans (
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

create index if not exists savings_plans_user_id_idx on public.savings_plans(user_id);


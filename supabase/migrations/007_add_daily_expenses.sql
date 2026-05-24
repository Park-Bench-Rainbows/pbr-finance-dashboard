-- 007_add_daily_expenses

create extension if not exists pgcrypto;

create table if not exists public.daily_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  description text not null,
  category text not null check (category in ('food','gas','coffee','groceries','dining','transport','other')),
  purchase_date date not null,
  original_currency text not null check (original_currency in ('TTD','USD','CAD')),
  original_amount_cents integer not null,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  base_amount_cents integer not null,
  fx_rate numeric(18,8) not null,
  fx_as_of timestamptz not null,
  fx_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_expenses_user_purchase_date_idx on public.daily_expenses(user_id, purchase_date);


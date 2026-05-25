-- 008_add_budgets_and_targets

create extension if not exists pgcrypto;

-- Budgets for daily spending categories (monthly)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('food','gas','coffee','groceries','dining','transport','other')),
  monthly_limit_cents integer not null,
  effective_month date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, category, effective_month)
);

create index if not exists budgets_user_month_idx on public.budgets(user_id, effective_month);

-- Savings targets
create table if not exists public.savings_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  target_base_cents integer not null,
  start_date date not null,
  target_date date not null,
  factor_in_existing_plans boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_targets_user_idx on public.savings_targets(user_id);

alter table public.savings_plans
  add column if not exists savings_target_id uuid references public.savings_targets(id) on delete set null;

create index if not exists savings_plans_target_idx on public.savings_plans(savings_target_id);


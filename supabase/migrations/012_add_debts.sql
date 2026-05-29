-- Debts and linked debt transactions
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  lender_name text not null,
  debt_type text not null check (debt_type in ('credit_card','car_loan','bank_loan','student_loan','personal_loan','buy_now_pay_later','other')),
  original_currency text check (original_currency in ('TTD','USD','CAD')),
  original_amount_cents integer,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  current_balance_cents integer not null,
  total_paid_cents integer not null default 0,
  interest_rate numeric(8,4),
  minimum_payment_cents integer,
  payment_frequency text check (payment_frequency in ('weekly','biweekly','monthly','quarterly','annual','custom')),
  payment_due_day integer,
  payment_due_date date,
  start_date date not null,
  target_payoff_date date,
  status text not null default 'active' check (status in ('active', 'partially_paid', 'paid', 'overdue', 'written_off', 'cancelled')),
  notes text,
  creates_cash_inflow boolean not null default false,
  linked_recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  created_borrowed_funds_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts (user_id);
create index if not exists debts_user_status_idx on public.debts (user_id, status);
create index if not exists debts_due_date_idx on public.debts (user_id, payment_due_date);

create table if not exists public.debt_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  source_type text not null default 'debt' check (source_type in ('debt')),
  direction text not null check (direction in ('inflow', 'outflow', 'adjustment')),
  category text not null check (category in ('borrowed_funds', 'debt_payment', 'interest_adjustment', 'fee_adjustment', 'balance_correction', 'new_charge')),
  balance_effect text not null default 'none' check (balance_effect in ('none', 'increase', 'decrease')),
  description text not null,
  transaction_date date not null,
  original_currency text check (original_currency in ('TTD','USD','CAD')),
  original_amount_cents integer not null,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  base_amount_cents integer not null,
  fx_rate numeric(18,8),
  fx_as_of timestamptz,
  fx_source text,
  linked_recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debt_transactions_user_date_idx
  on public.debt_transactions (user_id, transaction_date);

create index if not exists debt_transactions_debt_date_idx
  on public.debt_transactions (debt_id, transaction_date);

create table if not exists public.debt_payoff_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  target_payoff_date date not null,
  planned_monthly_payment_cents integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists debt_payoff_plans_debt_uq on public.debt_payoff_plans (debt_id);
create index if not exists debt_payoff_plans_user_idx on public.debt_payoff_plans (user_id);

alter table public.debts
  drop constraint if exists debts_created_borrowed_funds_transaction_fk;

alter table public.debts
  add constraint debts_created_borrowed_funds_transaction_fk
  foreign key (created_borrowed_funds_transaction_id)
  references public.debt_transactions(id)
  on delete set null;

alter table public.debts enable row level security;
alter table public.debt_transactions enable row level security;
alter table public.debt_payoff_plans enable row level security;

drop policy if exists "Users can view own debts" on public.debts;
create policy "Users can view own debts"
  on public.debts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own debts" on public.debts;
create policy "Users can insert own debts"
  on public.debts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own debts" on public.debts;
create policy "Users can update own debts"
  on public.debts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own debt transactions" on public.debt_transactions;
create policy "Users can view own debt transactions"
  on public.debt_transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own debt transactions" on public.debt_transactions;
create policy "Users can insert own debt transactions"
  on public.debt_transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own debt payoff plans" on public.debt_payoff_plans;
create policy "Users can view own debt payoff plans"
  on public.debt_payoff_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own debt payoff plans" on public.debt_payoff_plans;
create policy "Users can insert own debt payoff plans"
  on public.debt_payoff_plans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own debt payoff plans" on public.debt_payoff_plans;
create policy "Users can update own debt payoff plans"
  on public.debt_payoff_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.debts to authenticated;
grant select, insert on public.debt_transactions to authenticated;
grant select, insert, update on public.debt_payoff_plans to authenticated;

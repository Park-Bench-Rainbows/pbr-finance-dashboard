-- Loans and linked loan transactions
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  borrower_name text not null,
  description text not null,
  original_currency text not null check (original_currency in ('TTD','USD','CAD')),
  principal_amount_cents integer not null,
  base_currency text not null check (base_currency in ('TTD','USD','CAD')),
  base_principal_amount_cents integer not null,
  amount_repaid_cents integer not null default 0,
  outstanding_amount_cents integer not null,
  fx_rate numeric(18,8) not null,
  fx_as_of timestamptz not null,
  fx_source text not null,
  loan_date date not null,
  due_date date,
  status text not null default 'active' check (status in ('active', 'partially_paid', 'paid', 'overdue', 'written_off', 'cancelled')),
  notes text,
  created_expense_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_user_id_idx on public.loans (user_id);
create index if not exists loans_user_status_idx on public.loans (user_id, status);
create index if not exists loans_due_date_idx on public.loans (user_id, due_date);

create table if not exists public.loan_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  source_type text not null default 'loan' check (source_type in ('loan')),
  direction text not null check (direction in ('outflow', 'inflow')),
  category text not null check (category in ('money_lent', 'loan_repayment')),
  description text not null,
  transaction_date date not null,
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

create index if not exists loan_transactions_user_date_idx
  on public.loan_transactions (user_id, transaction_date);

create index if not exists loan_transactions_loan_date_idx
  on public.loan_transactions (loan_id, transaction_date);

alter table public.loans
  drop constraint if exists loans_created_expense_transaction_fk;

alter table public.loans
  add constraint loans_created_expense_transaction_fk
  foreign key (created_expense_transaction_id)
  references public.loan_transactions(id)
  on delete set null;

alter table public.loans enable row level security;
alter table public.loan_transactions enable row level security;

drop policy if exists "Users can view own loans" on public.loans;
create policy "Users can view own loans"
  on public.loans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own loans" on public.loans;
create policy "Users can insert own loans"
  on public.loans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own loans" on public.loans;
create policy "Users can update own loans"
  on public.loans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own loan transactions" on public.loan_transactions;
create policy "Users can view own loan transactions"
  on public.loan_transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own loan transactions" on public.loan_transactions;
create policy "Users can insert own loan transactions"
  on public.loan_transactions
  for insert
  with check (auth.uid() = user_id);

grant select, insert, update on public.loans to authenticated;
grant select, insert on public.loan_transactions to authenticated;

import { pgTable, uuid, text, integer, date, timestamp, numeric, uniqueIndex, boolean, index } from 'drizzle-orm/pg-core';

export const supportedCurrencies = ['TTD', 'USD', 'CAD'] as const;
export type CurrencyCode = (typeof supportedCurrencies)[number];

// Income table - stores user income sources
export const incomes = pgTable('incomes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  originalAmountCents: integer('original_amount_cents').notNull(), // cents in original currency
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(), // cents in base currency (used for summaries)
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(), // quote_per_base conversion used
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  frequency: text('frequency', { enum: ['monthly', 'biweekly'] }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'), // null = ongoing
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Recurring expenses table - stores user recurring expenses
export const recurringExpenses = pgTable('recurring_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  originalAmountCents: integer('original_amount_cents').notNull(), // cents in original currency
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(), // cents in base currency (used for summaries)
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(), // quote_per_base conversion used
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  frequency: text('frequency', { enum: ['monthly', 'annual'] }).notNull(),
  category: text('category', { 
    enum: ['housing', 'utilities', 'subscriptions', 'insurance', 'transportation', 'other'] 
  }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'), // null = ongoing
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Reference to Supabase auth.users table
// This is a stub - the actual table exists in Supabase's auth schema
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull().default('TTD'),
  theme: text('theme', { enum: ['light', 'dark', 'system'] }).notNull().default('system'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const fxRates = pgTable('fx_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  quoteCurrency: text('quote_currency', { enum: supportedCurrencies }).notNull(),
  rate: numeric('rate', { precision: 18, scale: 8 }).notNull(), // quote_per_base
  asOf: timestamp('as_of', { withTimezone: true }).notNull(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pairAsOfUq: uniqueIndex('fx_rates_pair_as_of_uq').on(table.baseCurrency, table.quoteCurrency, table.asOf),
}));

export const savingsPlans = pgTable('savings_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  originalAmountCents: integer('original_amount_cents').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(),
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  frequency: text('frequency', { enum: ['monthly', 'biweekly'] }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  savingsTargetId: uuid('savings_target_id').references(() => savingsTargets.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category', { enum: ['food', 'gas', 'coffee', 'groceries', 'dining', 'transport', 'other'] }).notNull(),
  monthlyLimitCents: integer('monthly_limit_cents').notNull(),
  effectiveMonth: date('effective_month').notNull(), // YYYY-MM-01
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const savingsTargets = pgTable('savings_targets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  targetBaseCents: integer('target_base_cents').notNull(),
  startDate: date('start_date').notNull(),
  targetDate: date('target_date').notNull(),
  factorInExistingPlans: boolean('factor_in_existing_plans').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dailyExpenses = pgTable('daily_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  category: text('category', { enum: ['food', 'gas', 'coffee', 'groceries', 'dining', 'transport', 'other'] }).notNull(),
  purchaseDate: date('purchase_date').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  originalAmountCents: integer('original_amount_cents').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(),
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const savingsTransactions = pgTable('savings_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  savingsTargetId: uuid('savings_target_id').references(() => savingsTargets.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  transactionDate: date('transaction_date').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  originalAmountCents: integer('original_amount_cents').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(),
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const loanStatuses = ['active', 'partially_paid', 'paid', 'overdue', 'written_off', 'cancelled'] as const;
export const loanTransactionDirections = ['outflow', 'inflow'] as const;
export const loanTransactionCategories = ['money_lent', 'loan_repayment'] as const;
export const transactionSourceTypes = ['loan'] as const;

export const debtStatuses = ['active', 'partially_paid', 'paid', 'overdue', 'written_off', 'cancelled'] as const;
export const debtTypes = [
  'credit_card',
  'car_loan',
  'bank_loan',
  'student_loan',
  'personal_loan',
  'buy_now_pay_later',
  'other',
] as const;
export const debtTransactionDirections = ['inflow', 'outflow', 'adjustment'] as const;
export const debtTransactionCategories = [
  'borrowed_funds',
  'debt_payment',
  'interest_adjustment',
  'fee_adjustment',
  'balance_correction',
  'new_charge',
] as const;
export const debtTransactionBalanceEffects = ['none', 'increase', 'decrease'] as const;
export const debtTransactionSourceTypes = ['debt'] as const;

export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  borrowerName: text('borrower_name').notNull(),
  description: text('description').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  principalAmountCents: integer('principal_amount_cents').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  basePrincipalAmountCents: integer('base_principal_amount_cents').notNull(),
  amountRepaidCents: integer('amount_repaid_cents').notNull().default(0),
  outstandingAmountCents: integer('outstanding_amount_cents').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(),
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  loanDate: date('loan_date').notNull(),
  dueDate: date('due_date'),
  status: text('status', { enum: loanStatuses }).notNull().default('active'),
  notes: text('notes'),
  createdExpenseTransactionId: uuid('created_expense_transaction_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  loansUserIdIdx: index('loans_user_id_idx').on(table.userId),
  loansUserStatusIdx: index('loans_user_status_idx').on(table.userId, table.status),
  loansDueDateIdx: index('loans_due_date_idx').on(table.userId, table.dueDate),
}));

export const loanTransactions = pgTable('loan_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', { enum: transactionSourceTypes }).notNull().default('loan'),
  direction: text('direction', { enum: loanTransactionDirections }).notNull(),
  category: text('category', { enum: loanTransactionCategories }).notNull(),
  description: text('description').notNull(),
  transactionDate: date('transaction_date').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }).notNull(),
  originalAmountCents: integer('original_amount_cents').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }).notNull(),
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }).notNull(),
  fxSource: text('fx_source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  loanTransactionsUserDateIdx: index('loan_transactions_user_date_idx').on(table.userId, table.transactionDate),
  loanTransactionsLoanDateIdx: index('loan_transactions_loan_date_idx').on(table.loanId, table.transactionDate),
}));

export const debts = pgTable('debts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  lenderName: text('lender_name').notNull(),
  debtType: text('debt_type', { enum: debtTypes }).notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }),
  originalAmountCents: integer('original_amount_cents'),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  currentBalanceCents: integer('current_balance_cents').notNull(),
  totalPaidCents: integer('total_paid_cents').notNull().default(0),
  interestRate: numeric('interest_rate', { precision: 8, scale: 4 }),
  minimumPaymentCents: integer('minimum_payment_cents'),
  paymentFrequency: text('payment_frequency', { enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'custom'] }),
  paymentDueDay: integer('payment_due_day'),
  paymentDueDate: date('payment_due_date'),
  startDate: date('start_date').notNull(),
  targetPayoffDate: date('target_payoff_date'),
  status: text('status', { enum: debtStatuses }).notNull().default('active'),
  notes: text('notes'),
  createsCashInflow: boolean('creates_cash_inflow').notNull().default(false),
  linkedRecurringExpenseId: uuid('linked_recurring_expense_id').references(() => recurringExpenses.id, { onDelete: 'set null' }),
  createdBorrowedFundsTransactionId: uuid('created_borrowed_funds_transaction_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  debtsUserIdIdx: index('debts_user_id_idx').on(table.userId),
  debtsUserStatusIdx: index('debts_user_status_idx').on(table.userId, table.status),
  debtsDueDateIdx: index('debts_due_date_idx').on(table.userId, table.paymentDueDate),
}));

export const debtTransactions = pgTable('debt_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  debtId: uuid('debt_id').notNull().references(() => debts.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', { enum: debtTransactionSourceTypes }).notNull().default('debt'),
  direction: text('direction', { enum: debtTransactionDirections }).notNull(),
  category: text('category', { enum: debtTransactionCategories }).notNull(),
  balanceEffect: text('balance_effect', { enum: debtTransactionBalanceEffects }).notNull().default('none'),
  description: text('description').notNull(),
  transactionDate: date('transaction_date').notNull(),
  originalCurrency: text('original_currency', { enum: supportedCurrencies }),
  originalAmountCents: integer('original_amount_cents').notNull(),
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
  baseAmountCents: integer('base_amount_cents').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  fxAsOf: timestamp('fx_as_of', { withTimezone: true }),
  fxSource: text('fx_source'),
  linkedRecurringExpenseId: uuid('linked_recurring_expense_id').references(() => recurringExpenses.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  debtTransactionsUserDateIdx: index('debt_transactions_user_date_idx').on(table.userId, table.transactionDate),
  debtTransactionsDebtDateIdx: index('debt_transactions_debt_date_idx').on(table.debtId, table.transactionDate),
}));

export const debtPayoffPlans = pgTable('debt_payoff_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  debtId: uuid('debt_id').notNull().references(() => debts.id, { onDelete: 'cascade' }),
  targetPayoffDate: date('target_payoff_date').notNull(),
  plannedMonthlyPaymentCents: integer('planned_monthly_payment_cents'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  debtPayoffPlansDebtUq: uniqueIndex('debt_payoff_plans_debt_uq').on(table.debtId),
  debtPayoffPlansUserIdx: index('debt_payoff_plans_user_idx').on(table.userId),
}));

import { pgTable, uuid, text, integer, date, timestamp, numeric, uniqueIndex, boolean } from 'drizzle-orm/pg-core';

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
  baseCurrency: text('base_currency', { enum: supportedCurrencies }).notNull(),
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

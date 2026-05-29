export type CurrencyCode = 'TTD' | 'USD' | 'CAD';
export type DailyCategory = 'food' | 'gas' | 'coffee' | 'groceries' | 'dining' | 'transport' | 'other';
export type ExpenseCategory = 'housing' | 'utilities' | 'subscriptions' | 'insurance' | 'transportation' | 'other';

export type UserSettingsResponse = {
  baseCurrency: CurrencyCode;
  theme?: 'light' | 'dark' | 'system';
};

export type DailyExpense = {
  id: string;
  description: string;
  category: DailyCategory;
  purchaseDate: string;
  amount: number;
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
};

export type Income = {
  id: string;
  name: string;
  amount: number;
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  frequency: 'monthly' | 'biweekly';
  startDate: string;
  endDate?: string;
};

export type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  frequency: 'monthly' | 'annual';
  category: ExpenseCategory;
  startDate: string;
  endDate?: string;
};

export type Budget = {
  id: string;
  category: DailyCategory;
  monthlyLimit: number;
  effectiveMonth: string;
};

export type SavingsPlan = {
  id: string;
  name: string;
  amount: number;
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  frequency: 'monthly' | 'biweekly';
  startDate: string;
  endDate?: string;
};

export type SavingsTarget = {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
  targetAmount: number;
  startDate: string;
  targetDate: string;
  factorInExistingPlans: boolean;
  plannedToDate?: number;
  plannedTotal?: number;
  percentPlannedToDate?: number;
  expectedToDate?: number;
  actualToDate?: number;
  percentActualToDate?: number;
  status?: 'on_track' | 'behind';
};

export type SavingsTargetMonthlyProgress = {
  month: string;
  planned: number;
  actual: number;
  expected: number;
  plannedCum: number;
  actualCum: number;
  expectedCum: number;
};

export type SavingsTransaction = {
  id: string;
  savingsTargetId?: string;
  description: string;
  transactionDate: string;
  amount: number;
  baseCurrency: CurrencyCode;
};

export type LoanStatus = 'active' | 'partially_paid' | 'paid' | 'overdue' | 'written_off' | 'cancelled';
export type LoanTransactionDirection = 'outflow' | 'inflow';
export type LoanTransactionCategory = 'money_lent' | 'loan_repayment';

export type LoanTransaction = {
  id: string;
  loanId: string;
  sourceType: 'loan';
  direction: LoanTransactionDirection;
  category: LoanTransactionCategory;
  description: string;
  transactionDate: string;
  amount: number;
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  fxRate: string;
  fxAsOf: string;
  fxSource: string;
};

export type Loan = {
  id: string;
  borrowerName: string;
  description: string;
  originalCurrency: CurrencyCode;
  principalAmount: number;
  baseCurrency: CurrencyCode;
  basePrincipalAmount: number;
  amountRepaid: number;
  outstandingAmount: number;
  fxRate: string;
  fxAsOf: string;
  fxSource: string;
  loanDate: string;
  dueDate?: string;
  status: LoanStatus;
  notes?: string;
  createdExpenseTransactionId?: string;
  transactions?: LoanTransaction[];
};

export type MonthlySummary = {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalDailySpend: number;
  remainingDisposable: number;
  disposableIncome: number;
  expensesByCategory: Record<string, number>;
  dailySpendByCategory: Record<string, number>;
  dailySpendByDay: { date: string; amount: number }[];
  budgetsByCategory: Record<string, number>;
  budgetRemainingByCategory: Record<string, number>;
};

export type TrendsPoint = {
  month: string;
  totalIncome: number;
  totalRecurringExpenses: number;
  totalDailySpend: number;
  dailySpendByCategory: Record<string, number>;
};

export type DailyExpensePayload = {
  description: string;
  amount: number;
  currency: CurrencyCode;
  category: DailyCategory;
  purchaseDate: string;
};

export type IncomePayload = {
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: 'monthly' | 'biweekly';
  startDate: string;
  endDate?: string;
};

export type RecurringExpensePayload = {
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: 'monthly' | 'annual';
  category: ExpenseCategory;
  startDate: string;
  endDate?: string;
};

export type SavingsPlanPayload = {
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: 'monthly' | 'biweekly';
  startDate: string;
  endDate?: string;
};

export type SavingsGoalPayload = {
  goalName: string;
  targetAmount: number;
  currency: CurrencyCode;
  startDate: string;
  targetDate: string;
  factorInExistingPlans: boolean;
  dryRun?: boolean;
};

export type SavingsGoalResponse = {
  baseCurrency?: CurrencyCode;
  schedule?: { month: string; plannedBaseAmount: number }[];
  target?: SavingsTarget;
  createdPlans?: SavingsPlan[];
};

export type SavingsTransactionPayload = {
  description: string;
  amount: number;
  currency: CurrencyCode;
  transactionDate: string;
  savingsTargetId?: string;
};

export type LoanPayload = {
  borrowerName: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  loanDate: string;
  dueDate?: string;
  notes?: string;
};

export type LoanRepaymentPayload = {
  amount: number;
  currency: CurrencyCode;
  repaymentDate: string;
  description?: string;
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  settings: () => apiFetch<UserSettingsResponse>('/api/settings'),
  updateSettings: (body: Partial<UserSettingsResponse>) =>
    apiFetch<UserSettingsResponse>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  summary: (month: string) => apiFetch<MonthlySummary>(`/api/summary?month=${month}`),
  trends: (month: string, endDate: string) =>
    apiFetch<{ points: TrendsPoint[] }>(`/api/trends?period=ytd&month=${month}&endDate=${endDate}`),
  dailyExpensesForMonth: (month: string) => apiFetch<DailyExpense[]>(`/api/daily-expenses?month=${month}`),
  dailyExpensesForDate: (date: string) => apiFetch<DailyExpense[]>(`/api/daily-expenses?date=${date}`),
  latestDailyExpenses: (limit: number) => apiFetch<DailyExpense[]>(`/api/daily-expenses?latest=${limit}`),
  createDailyExpense: (body: DailyExpensePayload) =>
    apiFetch<DailyExpense>('/api/daily-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateDailyExpense: (id: string, body: DailyExpensePayload) =>
    apiFetch<DailyExpense>(`/api/daily-expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteDailyExpense: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/daily-expenses/${id}`, {
      method: 'DELETE',
    }),
  incomes: () => apiFetch<Income[]>('/api/income'),
  createIncome: (body: IncomePayload) =>
    apiFetch<Income>('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateIncome: (id: string, body: IncomePayload) =>
    apiFetch<Income>(`/api/income/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteIncome: (id: string) => apiFetch<{ success: boolean }>(`/api/income/${id}`, { method: 'DELETE' }),
  recurringExpenses: () => apiFetch<RecurringExpense[]>('/api/expenses'),
  createRecurringExpense: (body: RecurringExpensePayload) =>
    apiFetch<RecurringExpense>('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateRecurringExpense: (id: string, body: RecurringExpensePayload) =>
    apiFetch<RecurringExpense>(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteRecurringExpense: (id: string) => apiFetch<{ success: boolean }>(`/api/expenses/${id}`, { method: 'DELETE' }),
  budgets: (month: string) => apiFetch<Budget[]>(`/api/budgets?month=${month}`),
  upsertBudget: (body: { month: string; category: DailyCategory; monthlyLimit: number }) =>
    apiFetch<Budget>('/api/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  savingsPlans: () => apiFetch<SavingsPlan[]>('/api/savings'),
  createSavingsPlan: (body: SavingsPlanPayload) =>
    apiFetch<SavingsPlan>('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateSavingsPlan: (id: string, body: Partial<SavingsPlanPayload>) =>
    apiFetch<SavingsPlan>(`/api/savings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteSavingsPlan: (id: string) => apiFetch<{ success: boolean }>(`/api/savings/${id}`, { method: 'DELETE' }),
  savingsTargets: (month: string) => apiFetch<SavingsTarget[]>(`/api/savings-targets?month=${month}`),
  savingsTargetProgress: (id: string, month: string) =>
    apiFetch<SavingsTargetMonthlyProgress[]>(`/api/savings-targets/${id}/progress?month=${month}`),
  quickContributeSavingsTarget: (id: string, month: string) =>
    apiFetch<{ created: boolean; transaction?: SavingsTransaction; remaining: number }>(
      `/api/savings-targets/${id}/quick-contribute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      }
    ),
  deleteSavingsTarget: (id: string, mode: 'preserve_contributions' | 'delete_contributions') =>
    apiFetch<{ success: boolean; mode: string }>(`/api/savings-targets/${id}?mode=${mode}`, { method: 'DELETE' }),
  savingsGoal: (body: SavingsGoalPayload) =>
    apiFetch<SavingsGoalResponse>('/api/savings/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  savingsTransactions: (month: string, savingsTargetId?: string) => {
    const searchParams = new URLSearchParams({ month });
    if (savingsTargetId) searchParams.set('savingsTargetId', savingsTargetId);
    return apiFetch<SavingsTransaction[]>(`/api/savings-transactions?${searchParams.toString()}`);
  },
  createSavingsTransaction: (body: SavingsTransactionPayload) =>
    apiFetch<SavingsTransaction>('/api/savings-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  loans: () => apiFetch<Loan[]>('/api/loans'),
  loan: (id: string) => apiFetch<Loan>(`/api/loans/${id}`),
  createLoan: (body: LoanPayload) =>
    apiFetch<Loan>('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateLoan: (id: string, body: Partial<LoanPayload> & { status?: LoanStatus }) =>
    apiFetch<Loan>(`/api/loans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  recordLoanRepayment: (id: string, body: LoanRepaymentPayload) =>
    apiFetch<Loan>(`/api/loans/${id}/repayments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};

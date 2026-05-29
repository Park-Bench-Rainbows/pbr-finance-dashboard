export const queryKeys = {
  settings: ['settings'] as const,
  summary: (month: string) => ['summary', month] as const,
  trends: (month: string) => ['trends', month] as const,
  incomes: ['incomes'] as const,
  recurringExpenses: ['recurring-expenses'] as const,
  budgets: (month: string) => ['budgets', month] as const,
  savingsPlans: ['savings-plans'] as const,
  savingsTargets: (month: string) => ['savings-targets', month] as const,
  savingsTargetProgress: (id: string, month: string) => ['savings-target-progress', id, month] as const,
  savingsTransactions: (month: string, savingsTargetId?: string) =>
    ['savings-transactions', month, savingsTargetId ?? 'all'] as const,
  loans: ['loans'] as const,
  loan: (id: string) => ['loans', id] as const,
  debts: ['debts'] as const,
  debt: (id: string) => ['debts', id] as const,
  debtPayoffPlan: (id: string) => ['debts', id, 'payoff-plan'] as const,
  dailyExpenses: {
    month: (month: string) => ['daily-expenses', 'month', month] as const,
    date: (date: string) => ['daily-expenses', 'date', date] as const,
    latest: (limit: number) => ['daily-expenses', 'latest', limit] as const,
  },
};

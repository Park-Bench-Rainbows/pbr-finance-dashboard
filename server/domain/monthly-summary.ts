import { ExpenseCategory } from './recurring-expense';
import { DailyExpenseCategory } from './daily-expense';
import { DailyExpenseCategory as BudgetCategory } from './budget';

export interface MonthlySummary {
  month: string; // YYYY-MM format
  totalIncome: number; // in dollars
  totalExpenses: number; // in dollars
  totalSavings: number; // in dollars
  totalDailySpend: number; // in dollars
  debtPaymentsTotal: number; // in dollars
  borrowedFundsTotal: number; // in dollars
  debtAdjustmentsNet: number; // in dollars
  cashflowAfterDebt: number; // in dollars
  remainingDisposable: number; // in dollars (disposableIncome - totalDailySpend)
  disposableIncome: number; // in dollars
  expensesByCategory: Partial<Record<ExpenseCategory, number>>; // sparse - only categories with expenses
  dailySpendByCategory: Partial<Record<DailyExpenseCategory, number>>;
  dailySpendByDay: { date: string; amount: number }[];
  budgetsByCategory: Partial<Record<BudgetCategory, number>>; // monthly limits
  budgetRemainingByCategory: Partial<Record<BudgetCategory, number>>;
}

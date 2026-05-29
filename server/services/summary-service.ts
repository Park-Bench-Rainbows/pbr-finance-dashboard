import { Income } from '../domain/income';
import { RecurringExpense, ExpenseCategory } from '../domain/recurring-expense';
import { MonthlySummary } from '../domain/monthly-summary';
import { IncomeRepository } from '../repositories/income-repository';
import { ExpenseRepository } from '../repositories/expense-repository';
import { SavingsPlanService } from './savings-plan-service';
import { DailyExpenseService } from './daily-expense-service';
import { BudgetService } from './budget-service';
import { DebtRepository } from '../repositories/debt-repository';

/**
 * SummaryService - Calculates monthly financial summaries
 */
export class SummaryService {
  private incomeRepository: IncomeRepository;
  private expenseRepository: ExpenseRepository;
  private savingsService: SavingsPlanService;
  private dailyExpenseService: DailyExpenseService;
  private budgetService: BudgetService;
  private debtRepository: DebtRepository;

  constructor(
    incomeRepository?: IncomeRepository,
    expenseRepository?: ExpenseRepository,
    savingsService?: SavingsPlanService,
    dailyExpenseService?: DailyExpenseService,
    budgetService?: BudgetService,
    debtRepository?: DebtRepository
  ) {
    this.incomeRepository = incomeRepository || new IncomeRepository();
    this.expenseRepository = expenseRepository || new ExpenseRepository();
    this.savingsService = savingsService || new SavingsPlanService();
    this.dailyExpenseService = dailyExpenseService || new DailyExpenseService();
    this.budgetService = budgetService || new BudgetService(undefined, this.dailyExpenseService);
    this.debtRepository = debtRepository || new DebtRepository();
  }
  /**
   * Get monthly summary for a specific user and month
   * 
   * @param userId - User ID (kept for multi-user readiness)
   * @param month - Month in YYYY-MM format
   * @returns Monthly summary with income, expenses, and disposable income
   */
  async getMonthlySummary(userId: string, month: string): Promise<MonthlySummary> {
    const activeIncomes = await this.incomeRepository.findActiveForMonth(userId, month);
    const activeExpenses = await this.expenseRepository.findActiveForMonth(userId, month);

    const totalIncome = this.calculateTotalMonthlyIncome(activeIncomes);
    const totalExpenses = this.calculateTotalMonthlyExpenses(activeExpenses);
    const totalSavings = await this.savingsService.calculateMonthlyTotal(userId, month);
    const totalDailySpend = await this.dailyExpenseService.calculateMonthlyTotal(userId, month);
    const debtTransactions = await this.debtRepository.findTransactionsForMonth(userId, month);
    const debtPaymentsTotal = debtTransactions
      .filter((tx) => tx.category === 'debt_payment')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const borrowedFundsTotal = debtTransactions
      .filter((tx) => tx.category === 'borrowed_funds')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const debtAdjustmentsNet = debtTransactions
      .filter((tx) => tx.direction === 'adjustment')
      .reduce((sum, tx) => {
        if (tx.balanceEffect === 'increase') return sum + tx.amount;
        if (tx.balanceEffect === 'decrease') return sum - tx.amount;
        return sum;
      }, 0);
    const expensesByCategory = this.groupExpensesByCategory(activeExpenses);
    const disposableIncome = totalIncome - totalExpenses - totalSavings;
    const remainingDisposable = disposableIncome - totalDailySpend;
    const cashflowAfterDebt = totalIncome + borrowedFundsTotal - totalExpenses - totalSavings - totalDailySpend - debtPaymentsTotal;
    const dailySpendByCategory = await this.dailyExpenseService.groupByCategory(userId, month);
    const dailySpendByDay = await this.dailyExpenseService.groupByDay(userId, month);
    const budgets = await this.budgetService.getBudgetsForMonth(userId, month);
    const budgetsByCategory: Record<string, number> = {};
    for (const b of budgets) budgetsByCategory[b.category] = b.monthlyLimit;
    const budgetRemainingByCategory = await this.budgetService.computeRemainingByCategory(userId, month);

    return {
      month,
      totalIncome,
      totalExpenses,
      totalSavings,
      totalDailySpend,
      debtPaymentsTotal,
      borrowedFundsTotal,
      debtAdjustmentsNet,
      cashflowAfterDebt,
      remainingDisposable,
      disposableIncome,
      expensesByCategory,
      dailySpendByCategory,
      dailySpendByDay,
      budgetsByCategory,
      budgetRemainingByCategory,
    };
  }

  /**
   * Calculate total monthly income from all income sources
   * Converts biweekly income to monthly equivalent
   */
  private calculateTotalMonthlyIncome(incomes: Income[]): number {
    return incomes.reduce((total, income) => {
      if (income.frequency === 'monthly') {
        return total + income.amount;
      } else if (income.frequency === 'biweekly') {
        // Biweekly: 26 pay periods per year, divide by 12 months
        return total + (income.amount * 26 / 12);
      }
      return total;
    }, 0);
  }

  /**
   * Calculate total monthly expenses from all recurring expenses
   * Converts annual expenses to monthly equivalent
   */
  private calculateTotalMonthlyExpenses(expenses: RecurringExpense[]): number {
    return expenses.reduce((total, expense) => {
      if (expense.frequency === 'monthly') {
        return total + expense.amount;
      } else if (expense.frequency === 'annual') {
        // Annual: divide by 12 months
        return total + (expense.amount / 12);
      }
      return total;
    }, 0);
  }

  /**
   * Group expenses by category
   * Returns sparse map - only includes categories that have expenses
   */
  private groupExpensesByCategory(expenses: RecurringExpense[]): Partial<Record<ExpenseCategory, number>> {
    const grouped: Partial<Record<ExpenseCategory, number>> = {};

    for (const expense of expenses) {
      const monthlyAmount = expense.frequency === 'monthly' 
        ? expense.amount 
        : expense.amount / 12;

      if (grouped[expense.category]) {
        grouped[expense.category]! += monthlyAmount;
      } else {
        grouped[expense.category] = monthlyAmount;
      }
    }

    return grouped;
  }

}

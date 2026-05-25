import { BudgetRepository } from '../repositories/budget-repository';
import { DailyExpenseService } from './daily-expense-service';
import { DailyExpenseCategory } from '../domain/budget';

export class BudgetService {
  private repo: BudgetRepository;
  private dailyExpenseService: DailyExpenseService;

  constructor(repo?: BudgetRepository, dailyExpenseService?: DailyExpenseService) {
    this.repo = repo ?? new BudgetRepository();
    this.dailyExpenseService = dailyExpenseService ?? new DailyExpenseService();
  }

  async getBudgetsForMonth(userId: string, month: string) {
    return this.repo.getForMonth(userId, month);
  }

  async upsertBudget(userId: string, category: DailyExpenseCategory, month: string, monthlyLimit: number) {
    return this.repo.upsert(userId, category, month, monthlyLimit);
  }

  async computeRemainingByCategory(userId: string, month: string): Promise<Partial<Record<DailyExpenseCategory, number>>> {
    const budgets = await this.repo.getForMonth(userId, month);
    const spendByCategory = await this.dailyExpenseService.groupByCategory(userId, month);

    const remaining: Partial<Record<DailyExpenseCategory, number>> = {};
    for (const b of budgets) {
      const spent = spendByCategory[b.category] ?? 0;
      remaining[b.category] = b.monthlyLimit - spent;
    }
    return remaining;
  }
}


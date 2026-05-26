import { DailyExpense, DailyExpenseCategory } from '../domain/daily-expense';
import { CreateDailyExpenseDTO, DailyExpenseRepository, UpdateDailyExpenseDTO } from '../repositories/daily-expense-repository';

export interface DailySpendByDay {
  date: string; // YYYY-MM-DD
  amount: number; // base currency dollars
}

export class DailyExpenseService {
  private repo: DailyExpenseRepository;

  constructor(repo?: DailyExpenseRepository) {
    this.repo = repo ?? new DailyExpenseRepository();
  }

  async getForMonth(userId: string, month: string): Promise<DailyExpense[]> {
    return this.repo.findForMonth(userId, month);
  }

  async getForDate(userId: string, dateISO: string): Promise<DailyExpense[]> {
    return this.repo.findForDate(userId, dateISO);
  }

  async getLatest(userId: string, limit: number): Promise<DailyExpense[]> {
    return this.repo.findLatest(userId, limit);
  }

  async create(userId: string, data: CreateDailyExpenseDTO): Promise<DailyExpense> {
    return this.repo.create(userId, data);
  }

  async update(id: string, userId: string, data: UpdateDailyExpenseDTO): Promise<DailyExpense> {
    return this.repo.update(id, userId, data);
  }

  async delete(id: string, userId: string): Promise<void> {
    return this.repo.delete(id, userId);
  }

  async calculateMonthlyTotal(userId: string, month: string): Promise<number> {
    const rows = await this.repo.findForMonth(userId, month);
    return rows.reduce((sum, r) => sum + r.amount, 0);
  }

  async groupByCategory(userId: string, month: string): Promise<Partial<Record<DailyExpenseCategory, number>>> {
    const rows = await this.repo.findForMonth(userId, month);
    const grouped: Partial<Record<DailyExpenseCategory, number>> = {};
    for (const row of rows) {
      grouped[row.category] = (grouped[row.category] ?? 0) + row.amount;
    }
    return grouped;
  }

  async groupByDay(userId: string, month: string): Promise<DailySpendByDay[]> {
    const rows = await this.repo.findForMonth(userId, month);
    const map = new Map<string, number>();
    for (const row of rows) {
      const date = row.purchaseDate.toISOString().split('T')[0];
      map.set(date, (map.get(date) ?? 0) + row.amount);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  }
}

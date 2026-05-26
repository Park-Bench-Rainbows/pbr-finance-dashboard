import { IncomeRepository } from '../repositories/income-repository';
import { ExpenseRepository } from '../repositories/expense-repository';
import { DailyExpenseRepository } from '../repositories/daily-expense-repository';

export type MonthlyTrendPoint = {
  month: string; // YYYY-MM
  totalIncome: number;
  totalRecurringExpenses: number;
  totalDailySpend: number;
  dailySpendByCategory: Record<string, number>;
};

function monthFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRange(month: string): { startISO: string; endISO: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const startISO = `${yearStr}-${monthStr}-01`;
  const endDate = new Date(year, m, 0);
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const endISO = `${endDate.getFullYear()}-${endMonth}-${endDay}`;
  return { startISO, endISO };
}

function listMonthsInclusive(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const months: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export class TrendsService {
  private incomeRepository: IncomeRepository;
  private expenseRepository: ExpenseRepository;
  private dailyExpenseRepository: DailyExpenseRepository;

  constructor(
    incomeRepository?: IncomeRepository,
    expenseRepository?: ExpenseRepository,
    dailyExpenseRepository?: DailyExpenseRepository
  ) {
    this.incomeRepository = incomeRepository ?? new IncomeRepository();
    this.expenseRepository = expenseRepository ?? new ExpenseRepository();
    this.dailyExpenseRepository = dailyExpenseRepository ?? new DailyExpenseRepository();
  }

  async getYtdMonthlyTrends(userId: string, endMonth: string, endDateISO?: string): Promise<MonthlyTrendPoint[]> {
    const year = endMonth.slice(0, 4);
    const startMonth = `${year}-01`;
    const months = listMonthsInclusive(startMonth, endMonth);

    const ytdStartISO = `${year}-01-01`;
    const ytdEndISO = endDateISO ?? toISODateLocal(new Date());
    const ytdDailyExpenses = await this.dailyExpenseRepository.findForRange(userId, ytdStartISO, ytdEndISO);

    const spendByMonthCategory = new Map<string, Map<string, number>>();
    const spendTotalByMonth = new Map<string, number>();
    for (const row of ytdDailyExpenses) {
      const month = monthFromDate(row.purchaseDate);
      const category = row.category;
      const byCat = spendByMonthCategory.get(month) ?? new Map<string, number>();
      byCat.set(category, (byCat.get(category) ?? 0) + row.amount);
      spendByMonthCategory.set(month, byCat);
      spendTotalByMonth.set(month, (spendTotalByMonth.get(month) ?? 0) + row.amount);
    }

    const points: MonthlyTrendPoint[] = [];
    for (const month of months) {
      const activeIncomes = await this.incomeRepository.findActiveForMonth(userId, month);
      const activeExpenses = await this.expenseRepository.findActiveForMonth(userId, month);

      const totalIncome = activeIncomes.reduce((sum, i) => {
        if (i.frequency === 'monthly') return sum + i.amount;
        if (i.frequency === 'biweekly') return sum + (i.amount * 26) / 12;
        return sum;
      }, 0);

      const totalRecurringExpenses = activeExpenses.reduce((sum, e) => {
        if (e.frequency === 'monthly') return sum + e.amount;
        if (e.frequency === 'annual') return sum + e.amount / 12;
        return sum;
      }, 0);

      const catMap = spendByMonthCategory.get(month);
      const dailySpendByCategory: Record<string, number> = {};
      if (catMap) {
        for (const [cat, amount] of catMap.entries()) dailySpendByCategory[cat] = amount;
      }

      points.push({
        month,
        totalIncome,
        totalRecurringExpenses,
        totalDailySpend: spendTotalByMonth.get(month) ?? 0,
        dailySpendByCategory,
      });
    }

    return points;
  }
}


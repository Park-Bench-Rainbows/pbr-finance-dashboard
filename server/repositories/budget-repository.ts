import { db } from '@/lib/db';
import { budgets } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { Budget, DailyExpenseCategory } from '../domain/budget';

export class BudgetRepository {
  async getForMonth(userId: string, month: string): Promise<Budget[]> {
    const effectiveMonth = `${month}-01`;
    const rows = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.effectiveMonth, effectiveMonth)));

    return rows.map((r : any) => this.toDomain(r));
  }

  async upsert(userId: string, category: DailyExpenseCategory, month: string, monthlyLimit: number): Promise<Budget> {
    const effectiveMonth = `${month}-01`;

    const [row] = await db
      .insert(budgets)
      .values({
        userId,
        category,
        monthlyLimitCents: Math.round(monthlyLimit * 100),
        effectiveMonth,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.category, budgets.effectiveMonth],
        set: {
          monthlyLimitCents: Math.round(monthlyLimit * 100),
          updatedAt: new Date(),
        },
      })
      .returning();

    return this.toDomain(row);
  }

  private toDomain(row: any): Budget {
    return {
      id: row.id,
      userId: row.userId,
      category: row.category,
      monthlyLimit: row.monthlyLimitCents / 100,
      effectiveMonth: String(row.effectiveMonth).slice(0, 7),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}


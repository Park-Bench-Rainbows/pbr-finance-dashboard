import { db } from '@/lib/db';
import { dailyExpenses } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { DailyExpense, DailyExpenseCategory } from '../domain/daily-expense';

export interface CreateDailyExpenseDTO {
  description: string;
  category: DailyExpenseCategory;
  purchaseDate: Date;
  amount: number; // original currency amount in dollars
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number; // base currency amount in dollars
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
}

export interface UpdateDailyExpenseDTO {
  description?: string;
  category?: DailyExpenseCategory;
  purchaseDate?: Date;
  amount?: number; // original currency amount in dollars
  currency?: 'TTD' | 'USD' | 'CAD';
  baseCurrency?: 'TTD' | 'USD' | 'CAD';
  baseAmount?: number; // base currency amount in dollars
  fxRate?: string;
  fxAsOf?: Date;
  fxSource?: string;
}

function monthRange(month: string): { start: string; end: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const endDate = new Date(year, m, 0); // last day of month, local
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const end = `${endDate.getFullYear()}-${endMonth}-${endDay}`;
  return { start, end };
}

export class DailyExpenseRepository {
  async findForDate(userId: string, dateISO: string): Promise<DailyExpense[]> {
    const rows = await db
      .select()
      .from(dailyExpenses)
      .where(and(eq(dailyExpenses.userId, userId), eq(dailyExpenses.purchaseDate, dateISO)))
      .orderBy(dailyExpenses.createdAt);

    return rows.map((r : any) => this.toDomain(r));
  }

  async findForMonth(userId: string, month: string): Promise<DailyExpense[]> {
    const { start, end } = monthRange(month);
    const rows = await db
      .select()
      .from(dailyExpenses)
      .where(and(eq(dailyExpenses.userId, userId), gte(dailyExpenses.purchaseDate, start), lte(dailyExpenses.purchaseDate, end)))
      .orderBy(dailyExpenses.purchaseDate);

    return rows.map((r : any) => this.toDomain(r));
  }

  async findForRange(userId: string, startISO: string, endISO: string): Promise<DailyExpense[]> {
    const rows = await db
      .select()
      .from(dailyExpenses)
      .where(and(eq(dailyExpenses.userId, userId), gte(dailyExpenses.purchaseDate, startISO), lte(dailyExpenses.purchaseDate, endISO)))
      .orderBy(dailyExpenses.purchaseDate);

    return rows.map((r: any) => this.toDomain(r));
  }

  async findByUserId(userId: string): Promise<DailyExpense[]> {
    const rows = await db.select().from(dailyExpenses).where(eq(dailyExpenses.userId, userId));
    return rows.map((r : any) => this.toDomain(r));
  }

  async create(userId: string, data: CreateDailyExpenseDTO): Promise<DailyExpense> {
    const [row] = await db
      .insert(dailyExpenses)
      .values({
        userId,
        description: data.description,
        category: data.category,
        purchaseDate: data.purchaseDate.toISOString().split('T')[0],
        originalCurrency: data.currency,
        originalAmountCents: Math.round(data.amount * 100),
        baseCurrency: data.baseCurrency,
        baseAmountCents: Math.round(data.baseAmount * 100),
        fxRate: data.fxRate,
        fxAsOf: data.fxAsOf,
        fxSource: data.fxSource,
      })
      .returning();

    return this.toDomain(row);
  }

  async update(id: string, userId: string, data: UpdateDailyExpenseDTO): Promise<DailyExpense> {
    const updateData: any = {};

    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate.toISOString().split('T')[0];
    if (data.currency !== undefined) updateData.originalCurrency = data.currency;
    if (data.amount !== undefined) updateData.originalAmountCents = Math.round(data.amount * 100);
    if (data.baseCurrency !== undefined) updateData.baseCurrency = data.baseCurrency;
    if (data.baseAmount !== undefined) updateData.baseAmountCents = Math.round(data.baseAmount * 100);
    if (data.fxRate !== undefined) updateData.fxRate = data.fxRate;
    if (data.fxAsOf !== undefined) updateData.fxAsOf = data.fxAsOf;
    if (data.fxSource !== undefined) updateData.fxSource = data.fxSource;

    updateData.updatedAt = new Date();

    const [row] = await db
      .update(dailyExpenses)
      .set(updateData)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning();

    if (!row) throw new Error('Daily expense not found or unauthorized');
    return this.toDomain(row);
  }

  async delete(id: string, userId: string): Promise<void> {
    const rows = await db
      .delete(dailyExpenses)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.userId, userId)))
      .returning();

    if (rows.length === 0) throw new Error('Daily expense not found or unauthorized');
  }

  private toDomain(row: any): DailyExpense {
    return {
      id: row.id,
      userId: row.userId,
      description: row.description,
      category: row.category,
      purchaseDate: new Date(row.purchaseDate),
      amount: row.baseAmountCents / 100,
      baseCurrency: row.baseCurrency,
      originalAmount: row.originalAmountCents / 100,
      originalCurrency: row.originalCurrency,
      fxRate: row.fxRate,
      fxAsOf: new Date(row.fxAsOf),
      fxSource: row.fxSource,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

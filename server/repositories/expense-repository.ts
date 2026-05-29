import { db } from '@/lib/db';
import { recurringExpenses } from '@/lib/db/schema';
import { RecurringExpense, ExpenseCategory, ExpenseFrequency } from '../domain/recurring-expense';
import { eq, and, lte, gte, or, isNull } from 'drizzle-orm';

export interface CreateExpenseDTO {
  name: string;
  amount: number; // original currency amount in dollars
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number; // base currency amount in dollars
  fxRate: string; // numeric string
  fxAsOf: Date;
  fxSource: string;
  frequency: ExpenseFrequency;
  category: ExpenseCategory;
  startDate: Date;
  endDate?: Date;
}

export interface UpdateExpenseDTO {
  name?: string;
  amount?: number; // original currency amount in dollars
  currency?: 'TTD' | 'USD' | 'CAD';
  baseCurrency?: 'TTD' | 'USD' | 'CAD';
  baseAmount?: number; // base currency amount in dollars
  fxRate?: string; // numeric string
  fxAsOf?: Date;
  fxSource?: string;
  frequency?: ExpenseFrequency;
  category?: ExpenseCategory;
  startDate?: Date;
  endDate?: Date;
}

export class ExpenseRepository {
  /**
   * Find all expenses for a specific user
   */
  async findByUserId(userId: string): Promise<RecurringExpense[]> {
    const results = await db
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.userId, userId));

    return results.map(this.toDomain);
  }

  async findById(userId: string, id: string): Promise<RecurringExpense | null> {
    const rows = await db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.id, id)))
      .limit(1);

    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  /**
   * Find expenses that are active for a specific month
   * Active = startDate <= month AND (endDate >= month OR endDate IS NULL)
   */
  async findActiveForMonth(userId: string, month: string): Promise<RecurringExpense[]> {
    // month is already "YYYY-MM"; keep comparisons timezone-stable.
    const monthStr = `${month}-01`;

    const results = await db
      .select()
      .from(recurringExpenses)
      .where(
        and(
          eq(recurringExpenses.userId, userId),
          lte(recurringExpenses.startDate, monthStr),
          or(
            gte(recurringExpenses.endDate, monthStr),
            isNull(recurringExpenses.endDate)
          )
        )
      );

    return results.map(this.toDomain);
  }

  /**
   * Create a new expense
   */
  async create(userId: string, data: CreateExpenseDTO): Promise<RecurringExpense> {
    const [result] = await db
      .insert(recurringExpenses)
      .values({
        userId,
        name: data.name,
        originalCurrency: data.currency,
        originalAmountCents: Math.round(data.amount * 100),
        baseCurrency: data.baseCurrency,
        baseAmountCents: Math.round(data.baseAmount * 100),
        fxRate: data.fxRate,
        fxAsOf: data.fxAsOf,
        fxSource: data.fxSource,
        frequency: data.frequency,
        category: data.category,
        startDate: data.startDate.toISOString().split('T')[0],
        endDate: data.endDate?.toISOString().split('T')[0],
      })
      .returning();

    return this.toDomain(result);
  }

  /**
   * Update an existing expense
   */
  async update(id: string, userId: string, data: UpdateExpenseDTO): Promise<RecurringExpense> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.currency !== undefined) updateData.originalCurrency = data.currency;
    if (data.amount !== undefined) updateData.originalAmountCents = Math.round(data.amount * 100);
    if (data.baseCurrency !== undefined) updateData.baseCurrency = data.baseCurrency;
    if (data.baseAmount !== undefined) updateData.baseAmountCents = Math.round(data.baseAmount * 100);
    if (data.fxRate !== undefined) updateData.fxRate = data.fxRate;
    if (data.fxAsOf !== undefined) updateData.fxAsOf = data.fxAsOf;
    if (data.fxSource !== undefined) updateData.fxSource = data.fxSource;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.startDate !== undefined) updateData.startDate = data.startDate.toISOString().split('T')[0];
    if (data.endDate !== undefined) updateData.endDate = data.endDate?.toISOString().split('T')[0];

    updateData.updatedAt = new Date();

    const [result] = await db
      .update(recurringExpenses)
      .set(updateData)
      .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
      .returning();

    if (!result) {
      throw new Error('Expense not found or unauthorized');
    }

    return this.toDomain(result);
  }

  /**
   * Delete an expense
   */
  async delete(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(recurringExpenses)
      .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new Error('Expense not found or unauthorized');
    }
  }

  /**
   * Convert database row to domain model
   * Converts cents to dollars
   */
  private toDomain(row: any): RecurringExpense {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      amount: row.baseAmountCents / 100,
      baseCurrency: row.baseCurrency,
      originalAmount: row.originalAmountCents / 100,
      originalCurrency: row.originalCurrency,
      fxRate: row.fxRate,
      fxAsOf: new Date(row.fxAsOf),
      fxSource: row.fxSource,
      frequency: row.frequency,
      category: row.category,
      startDate: new Date(row.startDate),
      endDate: row.endDate ? new Date(row.endDate) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

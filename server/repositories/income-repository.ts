import { db } from '@/lib/db';
import { incomes } from '@/lib/db/schema';
import { Income } from '../domain/income';
import { eq, and, lte, gte, or, isNull } from 'drizzle-orm';

export interface CreateIncomeDTO {
  name: string;
  amount: number; // original currency amount in dollars
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number; // base currency amount in dollars
  fxRate: string; // numeric string
  fxAsOf: Date;
  fxSource: string;
  frequency: 'monthly' | 'biweekly';
  startDate: Date;
  endDate?: Date;
}

export interface UpdateIncomeDTO {
  name?: string;
  amount?: number; // original currency amount in dollars
  currency?: 'TTD' | 'USD' | 'CAD';
  baseCurrency?: 'TTD' | 'USD' | 'CAD';
  baseAmount?: number; // base currency amount in dollars
  fxRate?: string; // numeric string
  fxAsOf?: Date;
  fxSource?: string;
  frequency?: 'monthly' | 'biweekly';
  startDate?: Date;
  endDate?: Date;
}

export class IncomeRepository {
  /**
   * Find all incomes for a specific user
   */
  async findByUserId(userId: string): Promise<Income[]> {
    const results = await db
      .select()
      .from(incomes)
      .where(eq(incomes.userId, userId));

    return results.map(this.toDomain);
  }

  /**
   * Find incomes that are active for a specific month
   * Active = startDate <= month AND (endDate >= month OR endDate IS NULL)
   */
  async findActiveForMonth(userId: string, month: string): Promise<Income[]> {
    // month is already "YYYY-MM"; keep comparisons timezone-stable.
    const monthStr = `${month}-01`;

    const results = await db
      .select()
      .from(incomes)
      .where(
        and(
          eq(incomes.userId, userId),
          lte(incomes.startDate, monthStr),
          or(
            gte(incomes.endDate, monthStr),
            isNull(incomes.endDate)
          )
        )
      );

    return results.map(this.toDomain);
  }

  /**
   * Create a new income
   */
  async create(userId: string, data: CreateIncomeDTO): Promise<Income> {
    const [result] = await db
      .insert(incomes)
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
        startDate: data.startDate.toISOString().split('T')[0],
        endDate: data.endDate?.toISOString().split('T')[0],
      })
      .returning();

    return this.toDomain(result);
  }

  /**
   * Update an existing income
   */
  async update(id: string, userId: string, data: UpdateIncomeDTO): Promise<Income> {
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
    if (data.startDate !== undefined) updateData.startDate = data.startDate.toISOString().split('T')[0];
    if (data.endDate !== undefined) updateData.endDate = data.endDate?.toISOString().split('T')[0];

    updateData.updatedAt = new Date();

    const [result] = await db
      .update(incomes)
      .set(updateData)
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .returning();

    if (!result) {
      throw new Error('Income not found or unauthorized');
    }

    return this.toDomain(result);
  }

  /**
   * Delete an income
   */
  async delete(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(incomes)
      .where(and(eq(incomes.id, id), eq(incomes.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new Error('Income not found or unauthorized');
    }
  }

  /**
   * Convert database row to domain model
   * Converts cents to dollars
   */
  private toDomain(row: any): Income {
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
      startDate: new Date(row.startDate),
      endDate: row.endDate ? new Date(row.endDate) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

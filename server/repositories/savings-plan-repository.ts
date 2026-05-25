import { db } from '@/lib/db';
import { savingsPlans } from '@/lib/db/schema';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { SavingsPlan } from '../domain/savings-plan';

export interface CreateSavingsPlanDTO {
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
  savingsTargetId?: string;
}

export interface UpdateSavingsPlanDTO {
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

export class SavingsPlanRepository {
  async findByUserId(userId: string): Promise<SavingsPlan[]> {
    const rows = await db.select().from(savingsPlans).where(eq(savingsPlans.userId, userId));
    return rows.map((r) => this.toDomain(r));
  }

  async findActiveForMonth(userId: string, month: string): Promise<SavingsPlan[]> {
    // month is already "YYYY-MM"; keep comparisons timezone-stable.
    const monthStr = `${month}-01`;

    const rows = await db
      .select()
      .from(savingsPlans)
      .where(
        and(
          eq(savingsPlans.userId, userId),
          lte(savingsPlans.startDate, monthStr),
          or(gte(savingsPlans.endDate, monthStr), isNull(savingsPlans.endDate))
        )
      );

    return rows.map((r) => this.toDomain(r));
  }

  async findActiveForMonthByTarget(userId: string, savingsTargetId: string, month: string): Promise<SavingsPlan[]> {
    const monthStr = `${month}-01`;

    const rows = await db
      .select()
      .from(savingsPlans)
      .where(
        and(
          eq(savingsPlans.userId, userId),
          eq(savingsPlans.savingsTargetId, savingsTargetId),
          lte(savingsPlans.startDate, monthStr),
          or(gte(savingsPlans.endDate, monthStr), isNull(savingsPlans.endDate))
        )
      );

    return rows.map((r) => this.toDomain(r));
  }

  async create(userId: string, data: CreateSavingsPlanDTO): Promise<SavingsPlan> {
    const [row] = await db
      .insert(savingsPlans)
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
        savingsTargetId: data.savingsTargetId,
      })
      .returning();

    return this.toDomain(row);
  }

  async update(id: string, userId: string, data: UpdateSavingsPlanDTO): Promise<SavingsPlan> {
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

    const [row] = await db
      .update(savingsPlans)
      .set(updateData)
      .where(and(eq(savingsPlans.id, id), eq(savingsPlans.userId, userId)))
      .returning();

    if (!row) throw new Error('Savings plan not found or unauthorized');

    return this.toDomain(row);
  }

  async delete(id: string, userId: string): Promise<void> {
    const rows = await db
      .delete(savingsPlans)
      .where(and(eq(savingsPlans.id, id), eq(savingsPlans.userId, userId)))
      .returning();

    if (rows.length === 0) throw new Error('Savings plan not found or unauthorized');
  }

  private toDomain(row: any): SavingsPlan {
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
      savingsTargetId: row.savingsTargetId ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

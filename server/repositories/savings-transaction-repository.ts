import { db } from '@/lib/db';
import { savingsTransactions } from '@/lib/db/schema';
import { and, eq, gte, lte, or } from 'drizzle-orm';
import { SavingsTransaction } from '../domain/savings-transaction';

export interface CreateSavingsTransactionDTO {
  description: string;
  transactionDate: Date;
  amount: number; // original currency dollars
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number; // base currency dollars
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
  savingsTargetId?: string;
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

export class SavingsTransactionRepository {
  async findForMonthByTarget(userId: string, targetId: string, month: string): Promise<SavingsTransaction[]> {
    const { start, end } = monthRange(month);
    const rows = await db
      .select()
      .from(savingsTransactions)
      .where(
        and(
          eq(savingsTransactions.userId, userId),
          eq(savingsTransactions.savingsTargetId, targetId),
          gte(savingsTransactions.transactionDate, start),
          lte(savingsTransactions.transactionDate, end)
        )
      )
      .orderBy(savingsTransactions.transactionDate);

    return rows.map((r : any) => this.toDomain(r));
  }

  async findForMonth(userId: string, month: string): Promise<SavingsTransaction[]> {
    const { start, end } = monthRange(month);
    const rows = await db
      .select()
      .from(savingsTransactions)
      .where(
        and(
          eq(savingsTransactions.userId, userId),
          gte(savingsTransactions.transactionDate, start),
          lte(savingsTransactions.transactionDate, end)
        )
      )
      .orderBy(savingsTransactions.transactionDate);

    return rows.map((r : any) => this.toDomain(r));
  }

  async findByTargetUpToDate(userId: string, targetId: string, cutoffDate: string): Promise<SavingsTransaction[]> {
    const rows = await db
      .select()
      .from(savingsTransactions)
      .where(
        and(
          eq(savingsTransactions.userId, userId),
          eq(savingsTransactions.savingsTargetId, targetId),
          lte(savingsTransactions.transactionDate, cutoffDate)
        )
      )
      .orderBy(savingsTransactions.transactionDate);

    return rows.map((r : any) => this.toDomain(r));
  }

  async findByTargetsUpToDate(
    userId: string,
    targetIds: string[],
    cutoffDate: string
  ): Promise<SavingsTransaction[]> {
    if (targetIds.length === 0) return [];

    // drizzle inArray can be used, but keep it simple by doing per-target queries in memory is worse.
    // Use raw "or" composition here for portability.
    const targetClauses = targetIds.map((id) => eq(savingsTransactions.savingsTargetId, id));
    const rows = await db
      .select()
      .from(savingsTransactions)
      .where(and(eq(savingsTransactions.userId, userId), lte(savingsTransactions.transactionDate, cutoffDate), or(...targetClauses)));

    return rows.map((r : any) => this.toDomain(r));
  }

  async create(userId: string, data: CreateSavingsTransactionDTO): Promise<SavingsTransaction> {
    const [row] = await db
      .insert(savingsTransactions)
      .values({
        userId,
        savingsTargetId: data.savingsTargetId,
        description: data.description,
        transactionDate: data.transactionDate.toISOString().slice(0, 10),
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

  private toDomain(row: any): SavingsTransaction {
    return {
      id: row.id,
      userId: row.userId,
      savingsTargetId: row.savingsTargetId ?? undefined,
      description: row.description,
      transactionDate: new Date(row.transactionDate),
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

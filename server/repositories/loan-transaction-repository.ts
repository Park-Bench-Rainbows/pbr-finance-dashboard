import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loanTransactions } from '@/lib/db/schema';
import { LoanTransaction } from '../domain/loan';

type LoanTransactionRow = {
  id: string;
  userId: string;
  loanId: string;
  sourceType: 'loan';
  direction: 'outflow' | 'inflow';
  category: 'money_lent' | 'loan_repayment';
  description: string;
  transactionDate: string | Date;
  originalCurrency: 'TTD' | 'USD' | 'CAD';
  originalAmountCents: number;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmountCents: number;
  fxRate: string;
  fxAsOf: string | Date;
  fxSource: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export interface CreateLoanTransactionDTO {
  loanId: string;
  sourceType?: 'loan';
  direction: 'outflow' | 'inflow';
  category: 'money_lent' | 'loan_repayment';
  description: string;
  transactionDate: Date;
  amount: number;
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number;
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
}

export class LoanTransactionRepository {
  async findByLoanId(userId: string, loanId: string): Promise<LoanTransaction[]> {
    const rows = await db
      .select()
      .from(loanTransactions)
      .where(and(eq(loanTransactions.userId, userId), eq(loanTransactions.loanId, loanId)))
      .orderBy(desc(loanTransactions.transactionDate), desc(loanTransactions.createdAt));

    return rows.map((row: LoanTransactionRow) => this.toDomain(row));
  }

  async create(userId: string, data: CreateLoanTransactionDTO): Promise<LoanTransaction> {
    const [row] = await db
      .insert(loanTransactions)
      .values({
        userId,
        loanId: data.loanId,
        sourceType: data.sourceType ?? 'loan',
        direction: data.direction,
        category: data.category,
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

    return this.toDomain(row as LoanTransactionRow);
  }

  private toDomain(row: LoanTransactionRow): LoanTransaction {
    return {
      id: row.id,
      userId: row.userId,
      loanId: row.loanId,
      sourceType: row.sourceType,
      direction: row.direction,
      category: row.category,
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

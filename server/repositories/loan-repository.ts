import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loanTransactions, loans } from '@/lib/db/schema';
import { Loan, LoanStatus } from '../domain/loan';
import { LoanTransactionRepository } from './loan-transaction-repository';

type LoanRow = {
  id: string;
  userId: string;
  borrowerName: string;
  description: string;
  originalCurrency: 'TTD' | 'USD' | 'CAD';
  principalAmountCents: number;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  basePrincipalAmountCents: number;
  amountRepaidCents: number;
  outstandingAmountCents: number;
  fxRate: string;
  fxAsOf: string | Date;
  fxSource: string;
  loanDate: string | Date;
  dueDate: string | Date | null;
  status: LoanStatus;
  notes: string | null;
  createdExpenseTransactionId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export interface CreateLoanDTO {
  borrowerName: string;
  description: string;
  amount: number; // original currency dollars
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number; // base currency dollars
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
  loanDate: Date;
  dueDate?: Date;
  notes?: string;
}

export interface UpdateLoanDTO {
  borrowerName?: string;
  description?: string;
  dueDate?: Date | null;
  notes?: string | null;
  status?: LoanStatus;
}

function isOverdue(dueDate: Date | undefined, outstandingAmount: number, status: LoanStatus): boolean {
  if (status === 'written_off' || status === 'cancelled' || status === 'paid') return false;
  if (!dueDate) return false;
  if (outstandingAmount <= 0) return false;
  const today = new Date();
  const due = new Date(dueDate);
  return due.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
}

function deriveStatus(status: LoanStatus, outstandingAmount: number, dueDate?: Date): LoanStatus {
  if (status === 'written_off' || status === 'cancelled') return status;
  if (outstandingAmount <= 0) return 'paid';
  if (dueDate && isOverdue(dueDate, outstandingAmount, status)) return 'overdue';
  if (status === 'partially_paid') return 'partially_paid';
  return 'active';
}

export class LoanRepository {
  private txRepo = new LoanTransactionRepository();

  async findByUserId(userId: string): Promise<Loan[]> {
    const rows = await db
      .select()
      .from(loans)
      .where(eq(loans.userId, userId))
      .orderBy(desc(loans.loanDate), desc(loans.createdAt));

    return this.hydrateLoans(userId, rows as LoanRow[]);
  }

  async findById(userId: string, id: string): Promise<Loan | null> {
    const [row] = await db
      .select()
      .from(loans)
      .where(and(eq(loans.userId, userId), eq(loans.id, id)));

    if (!row) return null;

    const [loan] = await this.hydrateLoans(userId, [row as LoanRow]);
    return loan ?? null;
  }

  async create(userId: string, data: CreateLoanDTO): Promise<Loan> {
    const created = await db.transaction(async (tx: typeof db) => {
      const [loanRow] = await tx
        .insert(loans)
        .values({
          userId,
          borrowerName: data.borrowerName,
          description: data.description,
          originalCurrency: data.currency,
          principalAmountCents: Math.round(data.amount * 100),
          baseCurrency: data.baseCurrency,
          basePrincipalAmountCents: Math.round(data.baseAmount * 100),
          amountRepaidCents: 0,
          outstandingAmountCents: Math.round(data.baseAmount * 100),
          fxRate: data.fxRate,
          fxAsOf: data.fxAsOf,
          fxSource: data.fxSource,
          loanDate: data.loanDate.toISOString().slice(0, 10),
          dueDate: data.dueDate?.toISOString().slice(0, 10),
          notes: data.notes,
          status: data.dueDate ? 'active' : 'active',
        })
        .returning();

      const [txRow] = await tx
        .insert(loanTransactions)
        .values({
          userId,
          loanId: loanRow.id,
          sourceType: 'loan',
          direction: 'outflow',
          category: 'money_lent',
          description: `Money lent to ${data.borrowerName}`,
          transactionDate: data.loanDate.toISOString().slice(0, 10),
          originalCurrency: data.currency,
          originalAmountCents: Math.round(data.amount * 100),
          baseCurrency: data.baseCurrency,
          baseAmountCents: Math.round(data.baseAmount * 100),
          fxRate: data.fxRate,
          fxAsOf: data.fxAsOf,
          fxSource: data.fxSource,
        })
        .returning();

      const [updatedLoan] = await tx
        .update(loans)
        .set({
          createdExpenseTransactionId: txRow.id,
          updatedAt: new Date(),
        })
        .where(eq(loans.id, loanRow.id))
        .returning();

      return updatedLoan;
    });

    return this.hydrateLoan(userId, created);
  }

  async update(id: string, userId: string, data: UpdateLoanDTO): Promise<Loan> {
    const updateData: {
      borrowerName?: string;
      description?: string;
      dueDate?: string | null;
      notes?: string | null;
      status?: LoanStatus;
      updatedAt?: Date;
    } = {};
    if (data.borrowerName !== undefined) updateData.borrowerName = data.borrowerName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? data.dueDate.toISOString().slice(0, 10) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;
    updateData.updatedAt = new Date();

    const [row] = await db
      .update(loans)
      .set(updateData)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();

    if (!row) {
      throw new Error('Loan not found or unauthorized');
    }

    return this.hydrateLoan(userId, row as LoanRow);
  }

  async recordRepayment(
    id: string,
    userId: string,
    data: {
      amount: number;
      currency: 'TTD' | 'USD' | 'CAD';
      baseCurrency: 'TTD' | 'USD' | 'CAD';
      baseAmount: number;
      fxRate: string;
      fxAsOf: Date;
      fxSource: string;
      repaymentDate: Date;
      description?: string;
    }
  ): Promise<Loan> {
    const currentLoan = await this.findById(userId, id);
    if (!currentLoan) throw new Error('Loan not found or unauthorized');

    const outstanding = currentLoan.outstandingAmount;
    if (data.baseAmount > outstanding + 0.00001) {
      throw new Error('Repayment exceeds outstanding balance');
    }

    const result = await db.transaction(async (tx: typeof db) => {
      await tx
        .insert(loanTransactions)
        .values({
          userId,
          loanId: id,
          sourceType: 'loan',
          direction: 'inflow',
          category: 'loan_repayment',
          description: data.description ?? `Repayment from ${currentLoan.borrowerName}`,
          transactionDate: data.repaymentDate.toISOString().slice(0, 10),
          originalCurrency: data.currency,
          originalAmountCents: Math.round(data.amount * 100),
          baseCurrency: data.baseCurrency,
          baseAmountCents: Math.round(data.baseAmount * 100),
          fxRate: data.fxRate,
          fxAsOf: data.fxAsOf,
          fxSource: data.fxSource,
        })
        .returning();

      const repaidCents = Math.round(data.baseAmount * 100);
      const nextAmountRepaid = currentLoan.amountRepaid * 100 + repaidCents;
      const nextOutstanding = Math.max(0, Math.round(currentLoan.basePrincipalAmount * 100) - nextAmountRepaid);
      const nextStatus: LoanStatus = nextOutstanding <= 0
        ? 'paid'
        : currentLoan.dueDate && this.isPastDue(currentLoan.dueDate) ? 'overdue' : 'partially_paid';

      const [updatedLoan] = await tx
        .update(loans)
        .set({
          amountRepaidCents: nextAmountRepaid,
          outstandingAmountCents: nextOutstanding,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(loans.id, id), eq(loans.userId, userId)))
        .returning();

      return updatedLoan;
    });

    return this.hydrateLoan(userId, result as LoanRow);
  }

  async findTransactionsByLoanId(userId: string, loanId: string) {
    return this.txRepo.findByLoanId(userId, loanId);
  }

  private async hydrateLoans(userId: string, rows: LoanRow[]): Promise<Loan[]> {
    const hydrated: Loan[] = [];
    for (const row of rows) {
      hydrated.push(await this.hydrateLoan(userId, row));
    }
    return hydrated;
  }

  private async hydrateLoan(userId: string, row: LoanRow): Promise<Loan> {
    const transactions = await this.txRepo.findByLoanId(userId, row.id);
    const inflowTotal = transactions
      .filter((tx) => tx.direction === 'inflow')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const outstandingAmount = Math.max(0, row.basePrincipalAmountCents / 100 - inflowTotal);
    const amountRepaid = inflowTotal;
    const status = deriveStatus(row.status as LoanStatus, outstandingAmount, row.dueDate ? new Date(row.dueDate) : undefined);

    return {
      id: row.id,
      userId: row.userId,
      borrowerName: row.borrowerName,
      description: row.description,
      originalCurrency: row.originalCurrency,
      principalAmount: row.principalAmountCents / 100,
      baseCurrency: row.baseCurrency,
      basePrincipalAmount: row.basePrincipalAmountCents / 100,
      amountRepaid,
      outstandingAmount,
      fxRate: row.fxRate,
      fxAsOf: new Date(row.fxAsOf),
      fxSource: row.fxSource,
      loanDate: new Date(row.loanDate),
      dueDate: row.dueDate ? new Date(row.dueDate) : undefined,
      status,
      notes: row.notes ?? undefined,
      createdExpenseTransactionId: row.createdExpenseTransactionId ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      transactions,
    };
  }

  private isPastDue(dueDate: Date): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    return due.getTime() < today.getTime();
  }
}

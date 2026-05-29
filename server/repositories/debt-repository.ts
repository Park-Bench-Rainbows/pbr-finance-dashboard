import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { debtPayoffPlans, debtTransactions, debts } from '@/lib/db/schema';
import {
  Debt,
  DebtPayoffPlan,
  DebtStatus,
  DebtTransaction,
  DebtTransactionBalanceEffect,
  DebtTransactionCategory,
  DebtTransactionDirection,
  DebtType,
} from '../domain/debt';

type DebtRow = {
  id: string;
  userId: string;
  name: string;
  lenderName: string;
  debtType: DebtType;
  originalCurrency: 'TTD' | 'USD' | 'CAD' | null;
  originalAmountCents: number | null;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  currentBalanceCents: number;
  totalPaidCents: number;
  interestRate: string | number | null;
  minimumPaymentCents: number | null;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'custom' | null;
  paymentDueDay: number | null;
  paymentDueDate: string | Date | null;
  startDate: string | Date;
  targetPayoffDate: string | Date | null;
  status: DebtStatus;
  notes: string | null;
  createsCashInflow: boolean;
  linkedRecurringExpenseId: string | null;
  createdBorrowedFundsTransactionId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type DebtTransactionRow = {
  id: string;
  userId: string;
  debtId: string;
  sourceType: 'debt';
  direction: DebtTransactionDirection;
  category: DebtTransactionCategory;
  balanceEffect: DebtTransactionBalanceEffect;
  description: string;
  transactionDate: string | Date;
  originalCurrency: 'TTD' | 'USD' | 'CAD' | null;
  originalAmountCents: number;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmountCents: number;
  fxRate: string | null;
  fxAsOf: string | Date | null;
  fxSource: string | null;
  linkedRecurringExpenseId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type DebtPayoffPlanRow = {
  id: string;
  userId: string;
  debtId: string;
  targetPayoffDate: string | Date;
  plannedMonthlyPaymentCents: number | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export interface CreateDebtDTO {
  name: string;
  lenderName: string;
  debtType: DebtType;
  amount: number;
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number;
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
  originalAmount?: number;
  originalCurrency?: 'TTD' | 'USD' | 'CAD';
  interestRate?: number;
  minimumPayment?: number;
  paymentFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
  paymentDueDay?: number;
  paymentDueDate?: Date;
  startDate: Date;
  targetPayoffDate?: Date;
  notes?: string;
  createsCashInflow?: boolean;
  linkedRecurringExpenseId?: string;
}

export interface UpdateDebtDTO {
  name?: string;
  lenderName?: string;
  debtType?: DebtType;
  interestRate?: number | null;
  minimumPayment?: number | null;
  paymentFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'custom' | null;
  paymentDueDay?: number | null;
  paymentDueDate?: Date | null;
  startDate?: Date;
  targetPayoffDate?: Date | null;
  notes?: string | null;
  createsCashInflow?: boolean;
  linkedRecurringExpenseId?: string | null;
  status?: DebtStatus;
}

export interface RecordDebtPaymentDTO {
  amount: number;
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number;
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
  paymentDate: Date;
  description?: string;
  linkedRecurringExpenseId?: string;
}

export interface AdjustDebtBalanceDTO {
  amount: number;
  currency: 'TTD' | 'USD' | 'CAD';
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  baseAmount: number;
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
  adjustmentDate: Date;
  category: 'interest_adjustment' | 'fee_adjustment' | 'balance_correction' | 'new_charge';
  effect: 'increase' | 'decrease';
  description?: string;
  linkedRecurringExpenseId?: string;
}

export interface UpsertDebtPayoffPlanDTO {
  targetPayoffDate: Date;
  plannedMonthlyPayment?: number;
  notes?: string;
}

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isPastDue(dueDate: Date): boolean {
  const now = new Date();
  return dayStart(dueDate).getTime() < dayStart(now).getTime();
}

function deriveStatus(status: DebtStatus, currentBalance: number, paymentDueDate?: Date): DebtStatus {
  if (status === 'written_off' || status === 'cancelled') return status;
  if (currentBalance <= 0) return 'paid';
  if (paymentDueDate && isPastDue(paymentDueDate)) return 'overdue';
  if (status === 'partially_paid') return 'partially_paid';
  return 'active';
}

function monthRange(month: string): { start: string; end: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const start = `${yearStr}-${monthStr}-01`;
  const endDate = new Date(year, m, 0);
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const end = `${endDate.getFullYear()}-${endMonth}-${endDay}`;
  return { start, end };
}

export class DebtRepository {
  async findByUserId(userId: string): Promise<Debt[]> {
    const rows = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(desc(debts.paymentDueDate), desc(debts.createdAt));

    return this.hydrateDebts(userId, rows as DebtRow[]);
  }

  async findById(userId: string, id: string): Promise<Debt | null> {
    const [row] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.id, id)));

    if (!row) return null;

    const [debt] = await this.hydrateDebts(userId, [row as DebtRow]);
    return debt ?? null;
  }

  async create(userId: string, data: CreateDebtDTO): Promise<Debt> {
    const created = await db.transaction(async (tx: typeof db) => {
      const [debtRow] = await tx
        .insert(debts)
        .values({
          userId,
          name: data.name,
          lenderName: data.lenderName,
          debtType: data.debtType,
          originalCurrency: data.originalAmount !== undefined ? data.originalCurrency ?? data.currency : null,
          originalAmountCents: data.originalAmount !== undefined ? Math.round(data.originalAmount * 100) : null,
          baseCurrency: data.baseCurrency,
          currentBalanceCents: Math.round(data.baseAmount * 100),
          totalPaidCents: 0,
          interestRate: data.interestRate,
          minimumPaymentCents: data.minimumPayment !== undefined ? Math.round(data.minimumPayment * 100) : null,
          paymentFrequency: data.paymentFrequency,
          paymentDueDay: data.paymentDueDay ?? null,
          paymentDueDate: data.paymentDueDate?.toISOString().slice(0, 10),
          startDate: data.startDate.toISOString().slice(0, 10),
          targetPayoffDate: data.targetPayoffDate?.toISOString().slice(0, 10),
          notes: data.notes,
          createsCashInflow: data.createsCashInflow ?? false,
          linkedRecurringExpenseId: data.linkedRecurringExpenseId ?? null,
          status: data.baseAmount <= 0 ? 'paid' : 'active',
        })
        .returning();

      let createdBorrowedFundsTransactionId: string | null = null;
      if (data.createsCashInflow) {
        const [txRow] = await tx
          .insert(debtTransactions)
          .values({
            userId,
            debtId: debtRow.id,
            sourceType: 'debt',
            direction: 'inflow',
            category: 'borrowed_funds',
            balanceEffect: 'none',
            description: `Borrowed funds for ${data.name}`,
            transactionDate: data.startDate.toISOString().slice(0, 10),
            originalCurrency: data.currency,
            originalAmountCents: Math.round(data.amount * 100),
            baseCurrency: data.baseCurrency,
            baseAmountCents: Math.round(data.baseAmount * 100),
            fxRate: data.fxRate,
            fxAsOf: data.fxAsOf,
            fxSource: data.fxSource,
          })
          .returning();

        createdBorrowedFundsTransactionId = txRow.id;
      }

      const [updatedDebt] = await tx
        .update(debts)
        .set({
          createdBorrowedFundsTransactionId,
          updatedAt: new Date(),
        })
        .where(eq(debts.id, debtRow.id))
        .returning();

      return updatedDebt;
    });

    return this.hydrateDebt(userId, created as DebtRow);
  }

  async update(id: string, userId: string, data: UpdateDebtDTO): Promise<Debt> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.lenderName !== undefined) updateData.lenderName = data.lenderName;
    if (data.debtType !== undefined) updateData.debtType = data.debtType;
    if (data.interestRate !== undefined) updateData.interestRate = data.interestRate;
    if (data.minimumPayment !== undefined) updateData.minimumPaymentCents = data.minimumPayment === null ? null : Math.round(data.minimumPayment * 100);
    if (data.paymentFrequency !== undefined) updateData.paymentFrequency = data.paymentFrequency;
    if (data.paymentDueDay !== undefined) updateData.paymentDueDay = data.paymentDueDay;
    if (data.paymentDueDate !== undefined) updateData.paymentDueDate = data.paymentDueDate ? data.paymentDueDate.toISOString().slice(0, 10) : null;
    if (data.startDate !== undefined) updateData.startDate = data.startDate.toISOString().slice(0, 10);
    if (data.targetPayoffDate !== undefined) updateData.targetPayoffDate = data.targetPayoffDate ? data.targetPayoffDate.toISOString().slice(0, 10) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.createsCashInflow !== undefined) updateData.createsCashInflow = data.createsCashInflow;
    if (data.linkedRecurringExpenseId !== undefined) updateData.linkedRecurringExpenseId = data.linkedRecurringExpenseId;
    if (data.status !== undefined) updateData.status = data.status;

    const [row] = await db
      .update(debts)
      .set(updateData)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();

    if (!row) {
      throw new Error('Debt not found or unauthorized');
    }

    return this.hydrateDebt(userId, row as DebtRow);
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new Error('Debt not found or unauthorized');
    }
  }

  async recordPayment(id: string, userId: string, data: RecordDebtPaymentDTO): Promise<Debt> {
    const currentDebt = await this.findById(userId, id);
    if (!currentDebt) throw new Error('Debt not found or unauthorized');

    const outstanding = currentDebt.currentBalance;
    if (data.baseAmount > outstanding + 0.00001) {
      throw new Error('Payment exceeds outstanding balance');
    }

    const result = await db.transaction(async (tx: typeof db) => {
      await tx
        .insert(debtTransactions)
        .values({
          userId,
          debtId: id,
          sourceType: 'debt',
          direction: 'outflow',
          category: 'debt_payment',
          balanceEffect: 'decrease',
          description: data.description ?? `Debt payment for ${currentDebt.name}`,
          transactionDate: data.paymentDate.toISOString().slice(0, 10),
          originalCurrency: data.currency,
          originalAmountCents: Math.round(data.amount * 100),
          baseCurrency: data.baseCurrency,
          baseAmountCents: Math.round(data.baseAmount * 100),
          fxRate: data.fxRate,
          fxAsOf: data.fxAsOf,
          fxSource: data.fxSource,
          linkedRecurringExpenseId: data.linkedRecurringExpenseId ?? currentDebt.linkedRecurringExpenseId ?? null,
        })
        .returning();

      const nextBalance = Math.max(0, Math.round(currentDebt.currentBalance * 100) - Math.round(data.baseAmount * 100));
      const nextPaid = Math.round(currentDebt.totalPaid * 100) + Math.round(data.baseAmount * 100);
      const nextStatus = deriveStatus(currentDebt.status, nextBalance / 100, currentDebt.paymentDueDate);

      const [updatedDebt] = await tx
        .update(debts)
        .set({
          currentBalanceCents: nextBalance,
          totalPaidCents: nextPaid,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(debts.id, id), eq(debts.userId, userId)))
        .returning();

      return updatedDebt;
    });

    return this.hydrateDebt(userId, result as DebtRow);
  }

  async adjustBalance(id: string, userId: string, data: AdjustDebtBalanceDTO): Promise<Debt> {
    const currentDebt = await this.findById(userId, id);
    if (!currentDebt) throw new Error('Debt not found or unauthorized');

    const effectMultiplier = data.effect === 'increase' ? 1 : -1;
    const signedBaseChange = Math.round(data.baseAmount * 100) * effectMultiplier;
    const nextBalanceCents = Math.round(currentDebt.currentBalance * 100) + signedBaseChange;
    if (nextBalanceCents < 0) {
      throw new Error('Adjustment would make debt balance negative');
    }

    const result = await db.transaction(async (tx: typeof db) => {
      await tx
        .insert(debtTransactions)
        .values({
          userId,
          debtId: id,
          sourceType: 'debt',
          direction: 'adjustment',
          category: data.category,
          balanceEffect: data.effect,
          description: data.description ?? this.defaultAdjustmentDescription(data.category, data.effect),
          transactionDate: data.adjustmentDate.toISOString().slice(0, 10),
          originalCurrency: data.currency,
          originalAmountCents: Math.round(data.amount * 100),
          baseCurrency: data.baseCurrency,
          baseAmountCents: Math.round(data.baseAmount * 100),
          fxRate: data.fxRate,
          fxAsOf: data.fxAsOf,
          fxSource: data.fxSource,
          linkedRecurringExpenseId: data.linkedRecurringExpenseId ?? currentDebt.linkedRecurringExpenseId ?? null,
        })
        .returning();

      const nextStatus = deriveStatus(currentDebt.status, nextBalanceCents / 100, currentDebt.paymentDueDate);

      const [updatedDebt] = await tx
        .update(debts)
        .set({
          currentBalanceCents: nextBalanceCents,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(debts.id, id), eq(debts.userId, userId)))
        .returning();

      return updatedDebt;
    });

    return this.hydrateDebt(userId, result as DebtRow);
  }

  async upsertPayoffPlan(id: string, userId: string, data: UpsertDebtPayoffPlanDTO): Promise<DebtPayoffPlan> {
    const [existing] = await db
      .select()
      .from(debtPayoffPlans)
      .where(and(eq(debtPayoffPlans.userId, userId), eq(debtPayoffPlans.debtId, id)));

    const values = {
      userId,
      debtId: id,
      targetPayoffDate: data.targetPayoffDate.toISOString().slice(0, 10),
      plannedMonthlyPaymentCents: data.plannedMonthlyPayment !== undefined ? Math.round(data.plannedMonthlyPayment * 100) : null,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    };

    const row = existing
      ? (await db
          .update(debtPayoffPlans)
          .set(values)
          .where(and(eq(debtPayoffPlans.id, existing.id), eq(debtPayoffPlans.userId, userId)))
          .returning())[0]
      : (await db
          .insert(debtPayoffPlans)
          .values(values)
          .returning())[0];

    await db
      .update(debts)
      .set({
        targetPayoffDate: values.targetPayoffDate,
        updatedAt: new Date(),
      })
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));

    return this.toPayoffPlan(row as DebtPayoffPlanRow);
  }

  async deletePayoffPlan(id: string, userId: string): Promise<void> {
    const result = await db
      .delete(debtPayoffPlans)
      .where(and(eq(debtPayoffPlans.userId, userId), eq(debtPayoffPlans.debtId, id)))
      .returning();

    if (result.length === 0) {
      throw new Error('Debt payoff plan not found or unauthorized');
    }

    await db
      .update(debts)
      .set({
        targetPayoffDate: null,
        updatedAt: new Date(),
      })
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));
  }

  async findTransactionsByDebtId(userId: string, debtId: string): Promise<DebtTransaction[]> {
    const rows = await db
      .select()
      .from(debtTransactions)
      .where(and(eq(debtTransactions.userId, userId), eq(debtTransactions.debtId, debtId)))
      .orderBy(desc(debtTransactions.transactionDate), desc(debtTransactions.createdAt));

    return rows.map((row: DebtTransactionRow) => this.toTransaction(row));
  }

  async findTransactionsForMonth(userId: string, month: string): Promise<DebtTransaction[]> {
    const { start, end } = monthRange(month);
    return this.findTransactionsByRange(userId, start, end);
  }

  async findTransactionsByRange(userId: string, startDate: string, endDate: string): Promise<DebtTransaction[]> {
    const rows = await db
      .select()
      .from(debtTransactions)
      .where(and(eq(debtTransactions.userId, userId), gte(debtTransactions.transactionDate, startDate), lte(debtTransactions.transactionDate, endDate)))
      .orderBy(desc(debtTransactions.transactionDate), desc(debtTransactions.createdAt));

    return rows.map((row: DebtTransactionRow) => this.toTransaction(row));
  }

  async findPayoffPlanByDebtId(userId: string, debtId: string): Promise<DebtPayoffPlan | null> {
    const [row] = await db
      .select()
      .from(debtPayoffPlans)
      .where(and(eq(debtPayoffPlans.userId, userId), eq(debtPayoffPlans.debtId, debtId)));

    return row ? this.toPayoffPlan(row as DebtPayoffPlanRow) : null;
  }

  private async hydrateDebts(userId: string, rows: DebtRow[]): Promise<Debt[]> {
    const hydrated: Debt[] = [];
    for (const row of rows) {
      hydrated.push(await this.hydrateDebt(userId, row));
    }
    return hydrated;
  }

  private async hydrateDebt(userId: string, row: DebtRow): Promise<Debt> {
    const [transactions, payoffPlan] = await Promise.all([
      this.findTransactionsByDebtId(userId, row.id),
      this.findPayoffPlanByDebtId(userId, row.id),
    ]);
    const currentBalance = row.currentBalanceCents / 100;
    const totalPaid = row.totalPaidCents / 100;
    const status = deriveStatus(row.status, currentBalance, row.paymentDueDate ? new Date(row.paymentDueDate) : undefined);

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      lenderName: row.lenderName,
      debtType: row.debtType,
      originalAmount: row.originalAmountCents !== null ? row.originalAmountCents / 100 : undefined,
      originalCurrency: row.originalCurrency ?? undefined,
      baseCurrency: row.baseCurrency,
      currentBalance,
      totalPaid,
      interestRate: row.interestRate !== null ? Number(row.interestRate) : undefined,
      minimumPayment: row.minimumPaymentCents !== null ? row.minimumPaymentCents / 100 : undefined,
      paymentFrequency: row.paymentFrequency ?? undefined,
      paymentDueDay: row.paymentDueDay ?? undefined,
      paymentDueDate: row.paymentDueDate ? new Date(row.paymentDueDate) : undefined,
      startDate: new Date(row.startDate),
      targetPayoffDate: row.targetPayoffDate ? new Date(row.targetPayoffDate) : undefined,
      status,
      notes: row.notes ?? undefined,
      createsCashInflow: row.createsCashInflow,
      linkedRecurringExpenseId: row.linkedRecurringExpenseId ?? undefined,
      createdBorrowedFundsTransactionId: row.createdBorrowedFundsTransactionId ?? undefined,
      payoffPlan: payoffPlan ?? undefined,
      transactions,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private toTransaction(row: DebtTransactionRow): DebtTransaction {
    return {
      id: row.id,
      userId: row.userId,
      debtId: row.debtId,
      sourceType: row.sourceType,
      direction: row.direction,
      category: row.category,
      balanceEffect: row.balanceEffect,
      description: row.description,
      transactionDate: new Date(row.transactionDate),
      amount: row.baseAmountCents / 100,
      baseCurrency: row.baseCurrency,
      originalAmount: row.originalAmountCents / 100,
      originalCurrency: row.originalCurrency ?? undefined,
      fxRate: row.fxRate ?? undefined,
      fxAsOf: row.fxAsOf ? new Date(row.fxAsOf) : undefined,
      fxSource: row.fxSource ?? undefined,
      linkedRecurringExpenseId: row.linkedRecurringExpenseId ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private toPayoffPlan(row: DebtPayoffPlanRow): DebtPayoffPlan {
    return {
      id: row.id,
      userId: row.userId,
      debtId: row.debtId,
      targetPayoffDate: new Date(row.targetPayoffDate),
      plannedMonthlyPayment: row.plannedMonthlyPaymentCents !== null ? row.plannedMonthlyPaymentCents / 100 : undefined,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private defaultAdjustmentDescription(category: AdjustDebtBalanceDTO['category'], effect: AdjustDebtBalanceDTO['effect']) {
    const label = category.replaceAll('_', ' ');
    return `${effect === 'increase' ? 'Increase' : 'Decrease'} debt balance for ${label}`;
  }
}

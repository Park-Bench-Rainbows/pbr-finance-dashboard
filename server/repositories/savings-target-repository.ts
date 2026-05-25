import { db } from '@/lib/db';
import { savingsPlans, savingsTargets, savingsTransactions } from '@/lib/db/schema';
import { and, eq, inArray, lte } from 'drizzle-orm';
import { SavingsTarget } from '../domain/savings-target';

export interface CreateSavingsTargetDTO {
  name: string;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  targetAmount: number; // base dollars
  startDate: Date;
  targetDate: Date;
  factorInExistingPlans: boolean;
}

export interface SavingsTargetProgress extends SavingsTarget {
  plannedToDate: number; // base dollars
  plannedTotal: number; // base dollars
  percentPlannedToDate: number; // 0-100
  expectedToDate: number; // base dollars
  actualToDate: number; // base dollars
  percentActualToDate: number; // 0-100
  status: 'on_track' | 'behind';
}

export class SavingsTargetRepository {
  async getById(userId: string, id: string): Promise<SavingsTarget | null> {
    const [row] = await db.select().from(savingsTargets).where(and(eq(savingsTargets.userId, userId), eq(savingsTargets.id, id)));
    return row ? this.toDomain(row) : null;
  }

  async create(userId: string, data: CreateSavingsTargetDTO): Promise<SavingsTarget> {
    const [row] = await db
      .insert(savingsTargets)
      .values({
        userId,
        name: data.name,
        baseCurrency: data.baseCurrency,
        targetBaseCents: Math.round(data.targetAmount * 100),
        startDate: data.startDate.toISOString().slice(0, 10),
        targetDate: data.targetDate.toISOString().slice(0, 10),
        factorInExistingPlans: data.factorInExistingPlans,
      })
      .returning();

    return this.toDomain(row);
  }

  async list(userId: string): Promise<SavingsTarget[]> {
    const rows = await db.select().from(savingsTargets).where(eq(savingsTargets.userId, userId));
    return rows.map((r : any) => this.toDomain(r));
  }

  async listWithProgress(userId: string, cutoffDate: string): Promise<SavingsTargetProgress[]> {
    const targets = await this.list(userId);
    if (targets.length === 0) return [];

    const targetIds = targets.map((t) => t.id);

    const planRowsToDate = await db
      .select()
      .from(savingsPlans)
      .where(
        and(
          eq(savingsPlans.userId, userId),
          inArray(savingsPlans.savingsTargetId, targetIds),
          lte(savingsPlans.startDate, cutoffDate)
        )
      );

    const planRowsAll = await db
      .select()
      .from(savingsPlans)
      .where(and(eq(savingsPlans.userId, userId), inArray(savingsPlans.savingsTargetId, targetIds)));

    const plannedToDateCentsByTarget = new Map<string, number>();
    const plannedTotalCentsByTarget = new Map<string, number>();
    const actualToDateCentsByTarget = new Map<string, number>();

    for (const row of planRowsToDate as any[]) {
      const targetId = row.savingsTargetId as string | null;
      if (!targetId) continue;

      const cents = Number(row.baseAmountCents ?? 0);
      plannedToDateCentsByTarget.set(targetId, (plannedToDateCentsByTarget.get(targetId) ?? 0) + cents);
    }

    for (const row of planRowsAll as any[]) {
      const targetId = row.savingsTargetId as string | null;
      if (!targetId) continue;
      const cents = Number(row.baseAmountCents ?? 0);
      plannedTotalCentsByTarget.set(targetId, (plannedTotalCentsByTarget.get(targetId) ?? 0) + cents);
    }

    let txRowsToDate: any[] = [];
    try {
      txRowsToDate = await db
        .select()
        .from(savingsTransactions)
        .where(
          and(
            eq(savingsTransactions.userId, userId),
            inArray(savingsTransactions.savingsTargetId, targetIds),
            lte(savingsTransactions.transactionDate, cutoffDate)
          )
        );
    } catch (e: any) {
      // If the savings transactions table hasn't been migrated yet, treat actual contributions as 0.
      // Postgres undefined_table error code is 42P01.
      if (e?.code !== '42P01') throw e;
      txRowsToDate = [];
    }

    for (const row of txRowsToDate as any[]) {
      const targetId = row.savingsTargetId as string | null;
      if (!targetId) continue;
      const cents = Number(row.baseAmountCents ?? 0);
      actualToDateCentsByTarget.set(targetId, (actualToDateCentsByTarget.get(targetId) ?? 0) + cents);
    }

    const cutoffMonth = new Date(cutoffDate);

    return targets.map((t) => {
      const plannedToDate = (plannedToDateCentsByTarget.get(t.id) ?? 0) / 100;
      const plannedTotal = (plannedTotalCentsByTarget.get(t.id) ?? 0) / 100;
      const percent = t.targetAmount > 0 ? Math.min(100, (plannedToDate / t.targetAmount) * 100) : 0;

      const totalMonths = this.inclusiveMonthCount(t.startDate, t.targetDate);
      const effectiveCutoff = cutoffMonth.getTime() > t.targetDate.getTime() ? t.targetDate : cutoffMonth;
      const elapsedMonths = effectiveCutoff.getTime() < t.startDate.getTime() ? 0 : this.inclusiveMonthCount(t.startDate, effectiveCutoff);
      const expectedToDate = totalMonths > 0 ? (t.targetAmount * elapsedMonths) / totalMonths : 0;

      const actualToDate = (actualToDateCentsByTarget.get(t.id) ?? 0) / 100;
      const percentActualToDate = t.targetAmount > 0 ? Math.min(100, (actualToDate / t.targetAmount) * 100) : 0;
      const status: 'on_track' | 'behind' = actualToDate >= expectedToDate ? 'on_track' : 'behind';
      return {
        ...t,
        plannedToDate,
        plannedTotal,
        percentPlannedToDate: percent,
        expectedToDate,
        actualToDate,
        percentActualToDate,
        status,
      };
    });
  }

  private inclusiveMonthCount(start: Date, end: Date): number {
    const a = start.getFullYear() * 12 + start.getMonth();
    const b = end.getFullYear() * 12 + end.getMonth();
    return Math.max(0, b - a + 1);
  }

  private toDomain(row: any): SavingsTarget {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      baseCurrency: row.baseCurrency,
      targetAmount: row.targetBaseCents / 100,
      startDate: new Date(row.startDate),
      targetDate: new Date(row.targetDate),
      factorInExistingPlans: row.factorInExistingPlans,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

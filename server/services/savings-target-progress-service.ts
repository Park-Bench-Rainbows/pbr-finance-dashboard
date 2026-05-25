import { SavingsTargetRepository } from '../repositories/savings-target-repository';
import { SavingsPlanRepository } from '../repositories/savings-plan-repository';
import { SavingsTransactionRepository } from '../repositories/savings-transaction-repository';

export type SavingsTargetMonthlyProgress = {
  month: string; // YYYY-MM
  planned: number; // dollars
  actual: number; // dollars
  expected: number; // dollars
  plannedCum: number;
  actualCum: number;
  expectedCum: number;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartDate(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function addMonths(d: Date, count: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + count, 1);
}

function inclusiveMonthCount(start: Date, end: Date): number {
  const a = start.getFullYear() * 12 + start.getMonth();
  const b = end.getFullYear() * 12 + end.getMonth();
  return Math.max(0, b - a + 1);
}

export class SavingsTargetProgressService {
  private targetRepo: SavingsTargetRepository;
  private planRepo: SavingsPlanRepository;
  private txRepo: SavingsTransactionRepository;

  constructor(opts?: {
    targetRepo?: SavingsTargetRepository;
    planRepo?: SavingsPlanRepository;
    txRepo?: SavingsTransactionRepository;
  }) {
    this.targetRepo = opts?.targetRepo ?? new SavingsTargetRepository();
    this.planRepo = opts?.planRepo ?? new SavingsPlanRepository();
    this.txRepo = opts?.txRepo ?? new SavingsTransactionRepository();
  }

  async getMonthlySeries(userId: string, targetId: string, month: string): Promise<SavingsTargetMonthlyProgress[]> {
    const target = await this.targetRepo.getById(userId, targetId);
    if (!target) throw new Error('Target not found');

    const startMonth = new Date(target.startDate.getFullYear(), target.startDate.getMonth(), 1);
    const targetEndMonth = new Date(target.targetDate.getFullYear(), target.targetDate.getMonth(), 1);
    const requestedEndMonth = monthStartDate(month);
    const endMonth = requestedEndMonth.getTime() > targetEndMonth.getTime() ? targetEndMonth : requestedEndMonth;

    const totalMonths = inclusiveMonthCount(startMonth, targetEndMonth);
    const expectedPerMonth = totalMonths > 0 ? target.targetAmount / totalMonths : 0;

    const rows: SavingsTargetMonthlyProgress[] = [];
    let plannedCum = 0;
    let actualCum = 0;
    let expectedCum = 0;

    let cur = new Date(startMonth);
    while (cur.getTime() <= endMonth.getTime()) {
      const ym = monthKey(cur);

      const plans = await this.planRepo.findActiveForMonthByTarget(userId, targetId, ym);
      const planned = plans.reduce((sum, p) => {
        if (p.frequency === 'monthly') return sum + p.amount;
        if (p.frequency === 'biweekly') return sum + (p.amount * 26) / 12;
        return sum;
      }, 0);

      const txs = await this.txRepo.findForMonthByTarget(userId, targetId, ym);
      const actual = txs.reduce((sum, t) => sum + t.amount, 0);

      const expected = expectedPerMonth;

      plannedCum += planned;
      actualCum += actual;
      expectedCum += expected;

      rows.push({ month: ym, planned, actual, expected, plannedCum, actualCum, expectedCum });
      cur = addMonths(cur, 1);
    }

    return rows;
  }

  async getMonthSnapshot(
    userId: string,
    targetId: string,
    month: string
  ): Promise<{ planned: number; actual: number; expected: number }> {
    const target = await this.targetRepo.getById(userId, targetId);
    if (!target) throw new Error('Target not found');

    const startMonth = new Date(target.startDate.getFullYear(), target.startDate.getMonth(), 1);
    const targetEndMonth = new Date(target.targetDate.getFullYear(), target.targetDate.getMonth(), 1);

    const totalMonths = inclusiveMonthCount(startMonth, targetEndMonth);
    const expected = totalMonths > 0 ? target.targetAmount / totalMonths : 0;

    const plans = await this.planRepo.findActiveForMonthByTarget(userId, targetId, month);
    const planned = plans.reduce((sum, p) => {
      if (p.frequency === 'monthly') return sum + p.amount;
      if (p.frequency === 'biweekly') return sum + (p.amount * 26) / 12;
      return sum;
    }, 0);

    const txs = await this.txRepo.findForMonthByTarget(userId, targetId, month);
    const actual = txs.reduce((sum, t) => sum + t.amount, 0);

    return { planned, actual, expected };
  }
}

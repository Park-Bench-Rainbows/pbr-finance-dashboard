import { describe, it, expect, vi } from 'vitest';
import { SavingsTargetProgressService } from '../savings-target-progress-service';

describe('SavingsTargetProgressService.getMonthSnapshot', () => {
  const userId = 'user-1';
  const targetId = 'target-1';

  it('calculates planned (monthly + biweekly) and actual totals', async () => {
    const targetRepo = {
      getById: vi.fn().mockResolvedValue({
        id: targetId,
        userId,
        name: 'Test Target',
        baseCurrency: 'TTD',
        targetAmount: 1200,
        startDate: new Date(2026, 0, 1),
        targetDate: new Date(2026, 2, 31),
        factorInExistingPlans: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as any;

    const planRepo = {
      findActiveForMonthByTarget: vi.fn().mockResolvedValue([
        { frequency: 'monthly', amount: 100 },
        { frequency: 'biweekly', amount: 50 },
      ]),
    } as any;

    const txRepo = {
      findForMonthByTarget: vi.fn().mockResolvedValue([{ amount: 60 }, { amount: 15 }]),
    } as any;

    const service = new SavingsTargetProgressService({ targetRepo, planRepo, txRepo });
    const snapshot = await service.getMonthSnapshot(userId, targetId, '2026-02');

    // planned: 100 + (50 * 26 / 12) = 208.333...
    expect(snapshot.planned).toBeCloseTo(208.33, 2);
    expect(snapshot.actual).toBe(75);
    // expected: targetAmount / inclusive months (Jan..Mar = 3)
    expect(snapshot.expected).toBe(400);
  });
});

import { describe, expect, it } from 'vitest';
import { computeSavingsGoalSchedule } from '../savings-goal-scheduler';

describe('computeSavingsGoalSchedule', () => {
  it('creates an even monthly schedule (ceil) when not factoring in existing plans', () => {
    const schedule = computeSavingsGoalSchedule({
      targetBaseCents: 100000, // 1000.00
      startDate: new Date(2026, 0, 15),
      targetDate: new Date(2026, 2, 10),
      factorInExistingPlans: false,
    });

    expect(schedule.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    // ceil rounding distributes: 333.34, 333.33, 333.33 (in some order), total must equal target
    const total = schedule.reduce((sum, m) => sum + m.plannedBaseCents, 0);
    expect(total).toBe(100000);
    expect(schedule[0].plannedBaseCents).toBeGreaterThanOrEqual(schedule[1].plannedBaseCents);
  });

  it('factors in existing savings and clamps negatives to 0 carrying remainder', () => {
    const schedule = computeSavingsGoalSchedule({
      targetBaseCents: 30000, // 300.00
      startDate: new Date(2026, 0, 1),
      targetDate: new Date(2026, 2, 31),
      factorInExistingPlans: true,
      existingMonthlySavingsBaseCentsByMonth: {
        '2026-01': 20000, // 200
        '2026-02': 20000, // 200
        '2026-03': 0,
      },
    });

    // Baseline would be 100/month; with existing it clamps Jan/Feb to 0 and pushes all to Mar.
    expect(schedule.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(schedule[0].plannedBaseCents).toBe(0);
    expect(schedule[1].plannedBaseCents).toBe(0);
    expect(schedule[2].plannedBaseCents).toBe(30000);
  });

  it('returns empty schedule when targetDate before startDate month', () => {
    const schedule = computeSavingsGoalSchedule({
      targetBaseCents: 1000,
      startDate: new Date(2026, 3, 1),
      targetDate: new Date(2026, 2, 31),
      factorInExistingPlans: false,
    });
    expect(schedule).toEqual([]);
  });
});

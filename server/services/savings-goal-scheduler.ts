export interface SavingsGoalScheduleInput {
  targetBaseCents: number;
  startDate: Date;
  targetDate: Date;
  factorInExistingPlans: boolean;
  existingMonthlySavingsBaseCentsByMonth?: Record<string, number>; // YYYY-MM -> cents
}

export interface SavingsGoalScheduleMonth {
  month: string; // YYYY-MM
  plannedBaseCents: number;
}

function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function listMonthsInclusive(startDate: Date, targetDate: Date): string[] {
  const start = monthStart(startDate);
  const end = monthStart(targetDate);

  if (end.getTime() < start.getTime()) {
    return [];
  }

  const months: string[] = [];
  let cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    months.push(toYearMonth(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months;
}

/**
 * Computes per-month planned base-currency contributions in cents.
 *
 * Rounding policy: ceil to ensure the total meets the target by the final month.
 * Shortfall policy: if factoring makes a month negative, clamp to 0 and carry remainder forward.
 */
export function computeSavingsGoalSchedule(input: SavingsGoalScheduleInput): SavingsGoalScheduleMonth[] {
  const months = listMonthsInclusive(input.startDate, input.targetDate);
  if (months.length === 0) return [];

  const existingMap = input.existingMonthlySavingsBaseCentsByMonth ?? {};

  let remaining = Math.max(0, Math.trunc(input.targetBaseCents));
  const schedule: SavingsGoalScheduleMonth[] = [];

  for (let index = 0; index < months.length; index++) {
    const month = months[index];
    const monthsRemaining = months.length - index;

    const baselineNeeded = Math.ceil(remaining / monthsRemaining);
    const existing = input.factorInExistingPlans ? Math.max(0, Math.trunc(existingMap[month] ?? 0)) : 0;

    const neededThisMonth = baselineNeeded - existing;
    const planned = Math.max(0, neededThisMonth);

    schedule.push({ month, plannedBaseCents: planned });
    remaining = Math.max(0, remaining - planned);
  }

  if (remaining > 0) {
    schedule[schedule.length - 1] = {
      month: schedule[schedule.length - 1].month,
      plannedBaseCents: schedule[schedule.length - 1].plannedBaseCents + remaining,
    };
  }

  return schedule;
}


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';
import { SavingsPlanService } from '@/server/services/savings-plan-service';
import { computeSavingsGoalSchedule, monthEnd, monthStart } from '@/server/services/savings-goal-scheduler';

const goalSchema = z.object({
  goalName: z.string().min(1, 'Goal name is required'),
  targetAmount: z.number().positive('Target amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  factorInExistingPlans: z.boolean(),
  dryRun: z.boolean().optional(),
});

function toYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = goalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const startDate = new Date(parsed.data.startDate);
    const targetDate = new Date(parsed.data.targetDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Validation failed', details: [{ message: 'Invalid dates' }] }, { status: 400 });
    }

    const startMonth = monthStart(startDate);
    const targetMonth = monthStart(targetDate);
    if (targetMonth.getTime() < startMonth.getTime()) {
      return NextResponse.json({ error: 'Target date must be on or after start date' }, { status: 400 });
    }

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const savingsService = new SavingsPlanService();

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);

    const targetOriginalCents = Math.round(parsed.data.targetAmount * 100);
    const targetBaseCents = Math.round(targetOriginalCents * parseFloat(quote.rate));

    const existingByMonth: Record<string, number> = {};
    if (parsed.data.factorInExistingPlans) {
      // compute existing planned savings per month in cents (base currency)
      let cur = new Date(startMonth);
      while (cur.getTime() <= targetMonth.getTime()) {
        const ym = toYearMonth(cur);
        const totalDollars = await savingsService.calculateMonthlyTotal(user.id, ym);
        existingByMonth[ym] = Math.round(totalDollars * 100);
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    }

    const schedule = computeSavingsGoalSchedule({
      targetBaseCents,
      startDate,
      targetDate,
      factorInExistingPlans: parsed.data.factorInExistingPlans,
      existingMonthlySavingsBaseCentsByMonth: existingByMonth,
    });

    if (schedule.length === 0) {
      return NextResponse.json({ error: 'No months in schedule' }, { status: 400 });
    }

    if (parsed.data.dryRun) {
      return NextResponse.json({
        baseCurrency,
        schedule: schedule.map((m) => ({ month: m.month, plannedBaseAmount: m.plannedBaseCents / 100 })),
      });
    }

    const createdPlans = [];

    if (!parsed.data.factorInExistingPlans) {
      const monthsCount = schedule.length;
      const monthlyBaseCents = Math.ceil(targetBaseCents / monthsCount);

      const created = await savingsService.create(user.id, {
        name: `${parsed.data.goalName} (goal)`,
        amount: parsed.data.targetAmount,
        currency: parsed.data.currency,
        baseCurrency,
        baseAmount: monthlyBaseCents / 100,
        fxRate: quote.rate,
        fxAsOf: quote.asOf,
        fxSource: quote.source,
        frequency: 'monthly',
        startDate,
        endDate: targetDate,
      });

      createdPlans.push(created);
    } else {
      for (const monthItem of schedule) {
        const [yearStr, monthStr] = monthItem.month.split('-');
        const d = new Date(Number(yearStr), Number(monthStr) - 1, 1);
        const periodStart = monthStart(d);
        const periodEnd = monthEnd(d);

        const created = await savingsService.create(user.id, {
          name: `${parsed.data.goalName} (goal: ${monthItem.month})`,
          amount: parsed.data.targetAmount,
          currency: parsed.data.currency,
          baseCurrency,
          baseAmount: monthItem.plannedBaseCents / 100,
          fxRate: quote.rate,
          fxAsOf: quote.asOf,
          fxSource: quote.source,
          frequency: 'monthly',
          startDate: periodStart,
          endDate: periodEnd,
        });

        createdPlans.push(created);
      }
    }

    return NextResponse.json({ createdPlans }, { status: 201 });
  } catch (error) {
    console.error('Error creating savings goal:', error);
    return NextResponse.json({ error: 'Failed to create savings goal' }, { status: 500 });
  }
}


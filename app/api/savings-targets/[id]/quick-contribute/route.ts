import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SavingsTargetProgressService } from '@/server/services/savings-target-progress-service';
import { SavingsTargetRepository } from '@/server/repositories/savings-target-repository';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { SavingsTransactionService } from '@/server/services/savings-transaction-service';

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)'),
});

function isCurrentMonth(month: string): boolean {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return month === current;
}

function monthEndISODate(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const endDate = new Date(year, m, 0); // local last day of month
  const mm = String(endDate.getMonth() + 1).padStart(2, '0');
  const dd = String(endDate.getDate()).padStart(2, '0');
  return `${endDate.getFullYear()}-${mm}-${dd}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const month = parsed.data.month;
    const progressService = new SavingsTargetProgressService();
    const targetRepo = new SavingsTargetRepository();
    const settingsService = new UserSettingsService();
    const txService = new SavingsTransactionService();

    const target = await targetRepo.getById(user.id, id);
    if (!target) return NextResponse.json({ error: 'Target not found' }, { status: 404 });

    const { planned, actual } = await progressService.getMonthSnapshot(user.id, id, month);
    const remaining = Math.max(0, planned - actual);

    if (remaining <= 0) {
      return NextResponse.json({ created: false, remaining: 0 });
    }

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;

    const transactionDateISO = isCurrentMonth(month)
      ? new Date().toISOString().slice(0, 10)
      : monthEndISODate(month);

    const created = await txService.create(user.id, {
      description: `${target.name} (quick add)`,
      transactionDate: new Date(transactionDateISO),
      amount: remaining,
      currency: baseCurrency,
      baseCurrency,
      baseAmount: remaining,
      fxRate: '1',
      fxAsOf: new Date(),
      fxSource: 'quick_add',
      savingsTargetId: id,
    });

    return NextResponse.json({ created: true, transaction: created, remaining: 0 }, { status: 201 });
  } catch (error) {
    console.error('Error quick-contributing to savings target:', error);
    return NextResponse.json({ error: 'Failed to quick add contribution' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DebtService } from '@/server/services/debt-service';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';

const adjustmentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  adjustmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  category: z.enum(['interest_adjustment', 'fee_adjustment', 'balance_correction', 'new_charge']),
  effect: z.enum(['increase', 'decrease']),
  description: z.string().optional(),
  linkedRecurringExpenseId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = adjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const debtService = new DebtService();

    const debt = await debtService.getById(user.id, id);
    if (!debt) return NextResponse.json({ error: 'Debt not found' }, { status: 404 });

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);
    const originalAmountCents = Math.round(parsed.data.amount * 100);
    const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

    const updated = await debtService.adjustBalance(id, user.id, {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      baseCurrency,
      baseAmount: baseAmountCents / 100,
      fxRate: quote.rate,
      fxAsOf: quote.asOf,
      fxSource: quote.source,
      adjustmentDate: new Date(parsed.data.adjustmentDate),
      category: parsed.data.category,
      effect: parsed.data.effect,
      description: parsed.data.description,
      linkedRecurringExpenseId: parsed.data.linkedRecurringExpenseId,
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error('Error recording debt adjustment:', error);
    if (error instanceof Error && error.message === 'Adjustment would make debt balance negative') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to record debt adjustment' }, { status: 500 });
  }
}

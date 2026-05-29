import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DebtService } from '@/server/services/debt-service';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';

const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
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
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const debtService = new DebtService();

    const debt = await debtService.getById(user.id, id);
    if (!debt) return NextResponse.json({ error: 'Debt not found' }, { status: 404 });
    if (parsed.data.amount > debt.currentBalance + 0.00001) {
      return NextResponse.json({ error: 'Payment exceeds outstanding balance' }, { status: 400 });
    }

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);
    const originalAmountCents = Math.round(parsed.data.amount * 100);
    const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

    const updated = await debtService.recordPayment(id, user.id, {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      baseCurrency,
      baseAmount: baseAmountCents / 100,
      fxRate: quote.rate,
      fxAsOf: quote.asOf,
      fxSource: quote.source,
      paymentDate: new Date(parsed.data.paymentDate),
      description: parsed.data.description,
      linkedRecurringExpenseId: parsed.data.linkedRecurringExpenseId,
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error('Error recording debt payment:', error);
    if (error instanceof Error && error.message === 'Payment exceeds outstanding balance') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to record debt payment' }, { status: 500 });
  }
}

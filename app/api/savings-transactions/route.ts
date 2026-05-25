import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';
import { SavingsTransactionService } from '@/server/services/savings-transaction-service';

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)').optional(),
  savingsTargetId: z.string().uuid().optional(),
});

const createSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  savingsTargetId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      month: searchParams.get('month') ?? undefined,
      savingsTargetId: searchParams.get('savingsTargetId') ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });

    const now = new Date();
    const month = parsed.data.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const service = new SavingsTransactionService();
    const rows = await service.getForMonth(user.id, month);
    const filtered = parsed.data.savingsTargetId
      ? rows.filter((r) => r.savingsTargetId === parsed.data.savingsTargetId)
      : rows;
    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching savings transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch savings transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const service = new SavingsTransactionService();

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);

    const originalAmountCents = Math.round(parsed.data.amount * 100);
    const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

    const created = await service.create(user.id, {
      description: parsed.data.description,
      transactionDate: new Date(parsed.data.transactionDate),
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      baseCurrency,
      baseAmount: baseAmountCents / 100,
      fxRate: quote.rate,
      fxAsOf: quote.asOf,
      fxSource: quote.source,
      savingsTargetId: parsed.data.savingsTargetId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating savings transaction:', error);
    return NextResponse.json({ error: 'Failed to create savings transaction' }, { status: 500 });
  }
}

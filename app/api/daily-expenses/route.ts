import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';
import { DailyExpenseService } from '@/server/services/daily-expense-service';

const createDailyExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  category: z.enum(['food', 'gas', 'coffee', 'groceries', 'dining', 'transport', 'other']),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
});

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)').optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? undefined;
    const parsed = querySchema.safeParse({ month });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const service = new DailyExpenseService();
    const rows = parsed.data.month
      ? await service.getForMonth(user.id, parsed.data.month)
      : await service.getForMonth(user.id, new Date().toISOString().slice(0, 7));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching daily expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch daily expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createDailyExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const dailyService = new DailyExpenseService();

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);

    const originalAmountCents = Math.round(parsed.data.amount * 100);
    const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

    const created = await dailyService.create(user.id, {
      description: parsed.data.description,
      category: parsed.data.category,
      purchaseDate: new Date(parsed.data.purchaseDate),
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      baseCurrency,
      baseAmount: baseAmountCents / 100,
      fxRate: quote.rate,
      fxAsOf: quote.asOf,
      fxSource: quote.source,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating daily expense:', error);
    return NextResponse.json({ error: 'Failed to create daily expense' }, { status: 500 });
  }
}


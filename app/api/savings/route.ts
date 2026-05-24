import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';
import { SavingsPlanService } from '@/server/services/savings-plan-service';

const createSavingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  frequency: z.enum(['monthly', 'biweekly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new SavingsPlanService();
    const plans = await service.getAll(user.id);

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error fetching savings plans:', error);
    return NextResponse.json({ error: 'Failed to fetch savings plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSavingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const savingsService = new SavingsPlanService();

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);

    const originalAmountCents = Math.round(parsed.data.amount * 100);
    const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

    const created = await savingsService.create(user.id, {
      name: parsed.data.name,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      baseCurrency,
      baseAmount: baseAmountCents / 100,
      fxRate: quote.rate,
      fxAsOf: quote.asOf,
      fxSource: quote.source,
      frequency: parsed.data.frequency,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating savings plan:', error);
    return NextResponse.json({ error: 'Failed to create savings plan' }, { status: 500 });
  }
}


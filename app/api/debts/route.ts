import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DebtService } from '@/server/services/debt-service';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';

const createDebtSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  lenderName: z.string().min(1, 'Lender name is required'),
  debtType: z.enum([
    'credit_card',
    'car_loan',
    'bank_loan',
    'student_loan',
    'personal_loan',
    'buy_now_pay_later',
    'other',
  ]),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['TTD', 'USD', 'CAD']),
  originalAmount: z.number().positive().optional(),
  originalCurrency: z.enum(['TTD', 'USD', 'CAD']).optional(),
  interestRate: z.number().nonnegative().optional(),
  minimumPayment: z.number().nonnegative().optional(),
  paymentFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'custom']).optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  targetPayoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
  notes: z.string().optional(),
  createsCashInflow: z.boolean().optional(),
  linkedRecurringExpenseId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = new DebtService();
    const debts = await service.getAll(user.id);
    return NextResponse.json(debts);
  } catch (error) {
    console.error('Error fetching debts:', error);
    return NextResponse.json({ error: 'Failed to fetch debts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createDebtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const settingsService = new UserSettingsService();
    const fxService = new FxService();
    const debtService = new DebtService();

    const settings = await settingsService.getOrDefault(user.id);
    const baseCurrency = settings.baseCurrency;
    const quote = await fxService.getQuote(parsed.data.currency, baseCurrency);
    const originalAmountCents = Math.round(parsed.data.amount * 100);
    const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

    const created = await debtService.create(user.id, {
      name: parsed.data.name,
      lenderName: parsed.data.lenderName,
      debtType: parsed.data.debtType,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      originalAmount: parsed.data.originalAmount,
      originalCurrency: parsed.data.originalCurrency,
      baseCurrency,
      baseAmount: baseAmountCents / 100,
      fxRate: quote.rate,
      fxAsOf: quote.asOf,
      fxSource: quote.source,
      interestRate: parsed.data.interestRate,
      minimumPayment: parsed.data.minimumPayment,
      paymentFrequency: parsed.data.paymentFrequency,
      paymentDueDay: parsed.data.paymentDueDay,
      paymentDueDate: parsed.data.paymentDueDate ? new Date(parsed.data.paymentDueDate) : undefined,
      startDate: new Date(parsed.data.startDate),
      targetPayoffDate: parsed.data.targetPayoffDate ? new Date(parsed.data.targetPayoffDate) : undefined,
      notes: parsed.data.notes,
      createsCashInflow: parsed.data.createsCashInflow,
      linkedRecurringExpenseId: parsed.data.linkedRecurringExpenseId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating debt:', error);
    return NextResponse.json({ error: 'Failed to create debt' }, { status: 500 });
  }
}

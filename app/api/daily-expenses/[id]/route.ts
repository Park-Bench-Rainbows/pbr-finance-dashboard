import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DailyExpenseService } from '@/server/services/daily-expense-service';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';

const updateDailyExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.enum(['TTD', 'USD', 'CAD']).optional(),
  category: z.enum(['food', 'gas', 'coffee', 'groceries', 'dining', 'transport', 'other']).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = updateDailyExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const service = new DailyExpenseService();
    const settingsService = new UserSettingsService();
    const fxService = new FxService();

    const data = parsed.data;
    const updateData: any = {};

    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.purchaseDate !== undefined) updateData.purchaseDate = new Date(data.purchaseDate);

    const hasMoneyUpdate = data.amount !== undefined || data.currency !== undefined;
    if (hasMoneyUpdate) {
      if (data.amount === undefined || data.currency === undefined) {
        return NextResponse.json(
          { error: 'Validation failed', details: [{ message: 'amount and currency must be provided together' }] },
          { status: 400 }
        );
      }

      const settings = await settingsService.getOrDefault(user.id);
      const baseCurrency = settings.baseCurrency;
      const quote = await fxService.getQuote(data.currency, baseCurrency);

      const originalAmountCents = Math.round(data.amount * 100);
      const baseAmountCents = Math.round(originalAmountCents * parseFloat(quote.rate));

      updateData.amount = data.amount;
      updateData.currency = data.currency;
      updateData.baseCurrency = baseCurrency;
      updateData.baseAmount = baseAmountCents / 100;
      updateData.fxRate = quote.rate;
      updateData.fxAsOf = quote.asOf;
      updateData.fxSource = quote.source;
    }

    const updated = await service.update(id, user.id, updateData);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating daily expense:', error);
    if (error.message === 'Daily expense not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update daily expense' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = new DailyExpenseService();
    await service.delete(id, user.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting daily expense:', error);
    if (error.message === 'Daily expense not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete daily expense' }, { status: 500 });
  }
}


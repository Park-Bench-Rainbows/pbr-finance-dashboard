import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ExpenseService } from '@/server/services/expense-service';
import { UserSettingsService } from '@/server/services/user-settings-service';
import { FxService } from '@/server/services/fx-service';

const updateExpenseSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.enum(['TTD', 'USD', 'CAD']).optional(),
  frequency: z.enum(['monthly', 'annual']).optional(),
  category: z.enum(['housing', 'utilities', 'subscriptions', 'insurance', 'transportation', 'other']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = updateExpenseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const service = new ExpenseService();
    const settingsService = new UserSettingsService();
    const fxService = new FxService();

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;

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

    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    const expense = await service.update(id, user.id, updateData);

    return NextResponse.json(expense);
  } catch (error: any) {
    console.error('Error updating expense:', error);
    
    if (error.message === 'Expense not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    );
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

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new ExpenseService();
    await service.delete(id, user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    
    if (error.message === 'Expense not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DebtService } from '@/server/services/debt-service';
import { ExpenseService } from '@/server/services/expense-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const debtService = new DebtService();
    const expenseService = new ExpenseService();

    const debt = await debtService.getById(user.id, id);
    if (!debt) return NextResponse.json({ error: 'Debt not found' }, { status: 404 });

    const recurringExpenseId = debt.linkedRecurringExpenseId;
    if (!recurringExpenseId) {
      return NextResponse.json({ error: 'No recurring expense linked to this debt' }, { status: 400 });
    }

    const recurringExpense = await expenseService.getById(user.id, recurringExpenseId);
    if (!recurringExpense) {
      return NextResponse.json({ error: 'Linked recurring expense not found' }, { status: 404 });
    }

    const updated = await debtService.recordPayment(id, user.id, {
      amount: recurringExpense.amount,
      currency: recurringExpense.baseCurrency,
      baseCurrency: recurringExpense.baseCurrency,
      baseAmount: recurringExpense.amount,
      fxRate: '1',
      fxAsOf: new Date(),
      fxSource: 'manual',
      paymentDate: new Date(),
      description: `Scheduled payment via ${recurringExpense.name}`,
      linkedRecurringExpenseId: recurringExpense.id,
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error('Error applying scheduled debt payment:', error);
    return NextResponse.json({ error: 'Failed to apply scheduled debt payment' }, { status: 500 });
  }
}

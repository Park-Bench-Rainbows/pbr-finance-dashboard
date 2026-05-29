import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DebtService } from '@/server/services/debt-service';

const updateDebtSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  lenderName: z.string().min(1, 'Lender name is required').optional(),
  debtType: z.enum([
    'credit_card',
    'car_loan',
    'bank_loan',
    'student_loan',
    'personal_loan',
    'buy_now_pay_later',
    'other',
  ]).optional(),
  interestRate: z.number().nonnegative().optional().nullable(),
  minimumPayment: z.number().nonnegative().optional().nullable(),
  paymentFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'custom']).optional().nullable(),
  paymentDueDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional(),
  targetPayoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional().nullable(),
  notes: z.string().optional().nullable(),
  createsCashInflow: z.boolean().optional(),
  linkedRecurringExpenseId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'partially_paid', 'paid', 'overdue', 'written_off', 'cancelled']).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = new DebtService();
    const debt = await service.getById(user.id, id);
    if (!debt) return NextResponse.json({ error: 'Debt not found' }, { status: 404 });

    return NextResponse.json(debt);
  } catch (error) {
    console.error('Error fetching debt:', error);
    return NextResponse.json({ error: 'Failed to fetch debt' }, { status: 500 });
  }
}

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
    const parsed = updateDebtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const service = new DebtService();
    const updated = await service.update(id, user.id, {
      name: parsed.data.name,
      lenderName: parsed.data.lenderName,
      debtType: parsed.data.debtType,
      interestRate: parsed.data.interestRate ?? undefined,
      minimumPayment: parsed.data.minimumPayment ?? undefined,
      paymentFrequency: parsed.data.paymentFrequency ?? undefined,
      paymentDueDay: parsed.data.paymentDueDay ?? undefined,
      paymentDueDate: parsed.data.paymentDueDate === null ? null : parsed.data.paymentDueDate ? new Date(parsed.data.paymentDueDate) : undefined,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      targetPayoffDate: parsed.data.targetPayoffDate === null ? null : parsed.data.targetPayoffDate ? new Date(parsed.data.targetPayoffDate) : undefined,
      notes: parsed.data.notes === null ? null : parsed.data.notes,
      createsCashInflow: parsed.data.createsCashInflow,
      linkedRecurringExpenseId: parsed.data.linkedRecurringExpenseId === null ? null : parsed.data.linkedRecurringExpenseId,
      status: parsed.data.status,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating debt:', error);
    if (error instanceof Error && error.message === 'Debt not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update debt' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = new DebtService();
    await service.delete(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting debt:', error);
    if (error instanceof Error && error.message === 'Debt not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete debt' }, { status: 500 });
  }
}

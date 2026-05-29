import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DebtService } from '@/server/services/debt-service';

const payoffPlanSchema = z.object({
  targetPayoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  plannedMonthlyPayment: z.number().positive().optional(),
  notes: z.string().optional(),
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
    const plan = await service.getPayoffPlan(user.id, id);
    if (!plan) return NextResponse.json({ error: 'Payoff plan not found' }, { status: 404 });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error fetching debt payoff plan:', error);
    return NextResponse.json({ error: 'Failed to fetch debt payoff plan' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = payoffPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const service = new DebtService();
    const plan = await service.upsertPayoffPlan(id, user.id, {
      targetPayoffDate: new Date(parsed.data.targetPayoffDate),
      plannedMonthlyPayment: parsed.data.plannedMonthlyPayment,
      notes: parsed.data.notes,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error('Error saving debt payoff plan:', error);
    return NextResponse.json({ error: 'Failed to save debt payoff plan' }, { status: 500 });
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
    await service.deletePayoffPlan(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting debt payoff plan:', error);
    if (error instanceof Error && error.message === 'Debt payoff plan not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete debt payoff plan' }, { status: 500 });
  }
}

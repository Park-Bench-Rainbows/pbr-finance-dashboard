import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { LoanService } from '@/server/services/loan-service';

const updateLoanSchema = z.object({
  borrowerName: z.string().min(1, 'Borrower name is required').optional(),
  description: z.string().min(1, 'Description is required').optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').optional().nullable(),
  notes: z.string().optional().nullable(),
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

    const service = new LoanService();
    const loan = await service.getById(user.id, id);
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error fetching loan:', error);
    return NextResponse.json({ error: 'Failed to fetch loan' }, { status: 500 });
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
    const parsed = updateLoanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const service = new LoanService();
    const updated = await service.update(id, user.id, {
      borrowerName: parsed.data.borrowerName,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate === null ? null : parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      notes: parsed.data.notes === null ? null : parsed.data.notes,
      status: parsed.data.status,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('Error updating loan:', error);
    if (error instanceof Error && error.message === 'Loan not found or unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 });
  }
}

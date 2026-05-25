import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SavingsTargetService } from '@/server/services/savings-target-service';

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)').optional(),
});

function monthEndISO(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const end = new Date(y, m, 0);
  const mm = String(end.getMonth() + 1).padStart(2, '0');
  const dd = String(end.getDate()).padStart(2, '0');
  return `${end.getFullYear()}-${mm}-${dd}`;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ month: searchParams.get('month') ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });

    const service = new SavingsTargetService();
    const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);
    const targets = await service.list(user.id, monthEndISO(month));
    return NextResponse.json(targets);
  } catch (error) {
    console.error('Error fetching savings targets:', error);
    return NextResponse.json({ error: 'Failed to fetch savings targets' }, { status: 500 });
  }
}

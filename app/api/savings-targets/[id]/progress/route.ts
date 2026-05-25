import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SavingsTargetProgressService } from '@/server/services/savings-target-progress-service';

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)'),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ month: searchParams.get('month') ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });

    const service = new SavingsTargetProgressService();
    const series = await service.getMonthlySeries(user.id, id, parsed.data.month);
    return NextResponse.json(series);
  } catch (error) {
    console.error('Error fetching savings target progress:', error);
    return NextResponse.json({ error: 'Failed to fetch target progress' }, { status: 500 });
  }
}


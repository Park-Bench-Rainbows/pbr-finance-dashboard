import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { TrendsService } from '@/server/services/trends-service';

const trendsQuerySchema = z.object({
  period: z.enum(['ytd']),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid endDate format (use YYYY-MM-DD)').optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const month = searchParams.get('month');
    const endDate = searchParams.get('endDate') ?? undefined;

    const validationResult = trendsQuerySchema.safeParse({ period, month, endDate });
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const service = new TrendsService();
    const points = await service.getYtdMonthlyTrends(user.id, validationResult.data.month, validationResult.data.endDate);
    return NextResponse.json({ points });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
  }
}


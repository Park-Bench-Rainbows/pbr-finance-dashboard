import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SummaryService } from '@/server/services/summary-service';

const summaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (use YYYY-MM)'),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month) {
      return NextResponse.json(
        { error: 'Month parameter is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    const validationResult = summaryQuerySchema.safeParse({ month });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const service = new SummaryService();
    const summary = await service.getMonthlySummary(user.id, month);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

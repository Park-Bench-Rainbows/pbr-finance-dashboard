import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { savingsPlans, savingsTargets, savingsTransactions } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const querySchema = z.object({
  mode: z.enum(['preserve_contributions', 'delete_contributions']).optional(),
});

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ mode: searchParams.get('mode') ?? undefined });
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });

    const mode = parsed.data.mode ?? 'preserve_contributions';

    // Delete dependent rows first so we don't lose the ability to filter by savings_target_id.
    await db.delete(savingsPlans).where(and(eq(savingsPlans.userId, user.id), eq(savingsPlans.savingsTargetId, id)));

    if (mode === 'delete_contributions') {
      await db
        .delete(savingsTransactions)
        .where(and(eq(savingsTransactions.userId, user.id), eq(savingsTransactions.savingsTargetId, id)));
    }

    const deletedTargets = await db
      .delete(savingsTargets)
      .where(and(eq(savingsTargets.userId, user.id), eq(savingsTargets.id, id)))
      .returning({ id: savingsTargets.id });

    if (deletedTargets.length === 0) {
      return NextResponse.json({ error: 'Target not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, mode }, { status: 200 });
  } catch (error) {
    console.error('Error deleting savings target:', error);
    return NextResponse.json({ error: 'Failed to delete savings target' }, { status: 500 });
  }
}


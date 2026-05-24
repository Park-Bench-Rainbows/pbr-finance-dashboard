import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UserSettingsService } from '@/server/services/user-settings-service';

const supportedCurrencies = ['TTD', 'USD', 'CAD'] as const;
const supportedThemes = ['light', 'dark', 'system'] as const;

const updateSettingsSchema = z.object({
  baseCurrency: z.enum(supportedCurrencies).optional(),
  theme: z.enum(supportedThemes).optional(),
}).refine((v) => v.baseCurrency !== undefined || v.theme !== undefined, {
  message: 'At least one field must be provided',
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new UserSettingsService();
    const settings = await service.getOrDefault(user.id);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const service = new UserSettingsService();
    const settings = await service.update(user.id, {
      baseCurrency: parsed.data.baseCurrency,
      theme: parsed.data.theme,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

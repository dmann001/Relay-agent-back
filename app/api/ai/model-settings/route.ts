import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import {
  OPENAI_MODEL_OPTIONS,
  aiModelSettingsSchema,
  getAiModelSettings,
  updateAiModelSettings,
} from '@/lib/server/ai-model-settings';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    return NextResponse.json({
      settings: await getAiModelSettings(userId),
      models: OPENAI_MODEL_OPTIONS,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = aiModelSettingsSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid AI model settings' }, { status: 400 });
    }

    return NextResponse.json({
      settings: await updateAiModelSettings(userId, parsed.data),
      models: OPENAI_MODEL_OPTIONS,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

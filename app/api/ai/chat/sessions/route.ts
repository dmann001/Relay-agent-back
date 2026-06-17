import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { createAiChatSession, listAiChatSessions } from '@/lib/server/ai-chat-sessions';

const createSchema = z.object({
  accountId: z.string().trim().min(1).max(128).optional(),
  messageId: z.string().trim().min(1).max(256).optional(),
  title: z.string().trim().max(120).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const limit = Number(request.nextUrl.searchParams.get('limit') || '50');
    const sessions = await listAiChatSessions(userId, Number.isFinite(limit) ? Math.min(limit, 100) : 50);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid chat session payload.' }, { status: 400 });
    }

    const session = await createAiChatSession(userId, parsed.data);
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}

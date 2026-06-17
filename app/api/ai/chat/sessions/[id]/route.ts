import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { deleteAiChatSession, getAiChatSession } from '@/lib/server/ai-chat-sessions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const session = await getAiChatSession(userId, id);
    if (!session) return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const deleted = await deleteAiChatSession(userId, id);
    if (!deleted) return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

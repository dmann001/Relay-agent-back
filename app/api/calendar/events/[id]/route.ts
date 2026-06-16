import { NextRequest, NextResponse } from 'next/server';
import { createAgentRun, finishAgentRun } from '@/lib/server/agent-activity';
import { handleApiError } from '@/lib/server/api-utils';
import { getCalendarConnection } from '@/lib/server/calendar-connections';
import { deleteProviderCalendarEvent } from '@/lib/server/calendar-events';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let run: any = null;
  let userId = '';
  try {
    userId = await requireUser(request);
    const { id } = await context.params;
    const { data: link, error } = await getSupabaseAdmin().from('calendar_event_links').select('*')
      .eq('user_id', userId).eq('id', id).eq('status', 'active').maybeSingle();
    if (error) throw error;
    if (!link) return NextResponse.json({ error: 'Calendar reminder not found' }, { status: 404 });
    const connection = await getCalendarConnection(userId, link.account_id);
    if (!connection) return NextResponse.json({ error: 'Reconnect this account calendar first' }, { status: 409 });
    run = await createAgentRun({
      userId, accountId: link.account_id, agentType: 'calendar_event_delete',
      sourceType: 'calendar_event', sourceId: link.id, status: 'running',
      title: `Remove “${link.title}” from calendar`,
    });
    await deleteProviderCalendarEvent(connection, link.provider_calendar_id, link.provider_event_id);
    const { error: updateError } = await getSupabaseAdmin().from('calendar_event_links')
      .update({ status: 'deleted', last_error: null }).eq('id', link.id).eq('user_id', userId);
    if (updateError) throw updateError;
    await finishAgentRun({
      userId, agentRunId: run.id, status: 'completed',
      summary: 'Calendar reminder removed.',
      outputManifest: { calendarEventLinkId: link.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (run && userId) {
      await finishAgentRun({
        userId, agentRunId: run.id, status: 'failed',
        summary: 'Calendar reminder could not be removed.',
        errorMessage: error instanceof Error ? error.message : 'Unknown calendar error',
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

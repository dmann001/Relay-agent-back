import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAgentRun, finishAgentRun } from '@/lib/server/agent-activity';
import { handleApiError } from '@/lib/server/api-utils';
import { getCalendarConnection } from '@/lib/server/calendar-connections';
import { createProviderCalendarEvent } from '@/lib/server/calendar-events';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

const createSchema = z.object({
  commitmentId: z.string().uuid(),
  reminderMinutes: z.number().int().min(0).max(40320).default(30),
});

const serializeLink = (row: any) => ({
  id: row.id, accountId: row.account_id, commitmentId: row.commitment_id,
  provider: row.provider, title: row.title, startsAt: row.starts_at,
  endsAt: row.ends_at, timezone: row.timezone, status: row.status,
  createdAt: row.created_at,
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const { data, error } = await getSupabaseAdmin().from('calendar_event_links').select('*')
      .eq('user_id', userId).eq('status', 'active').order('starts_at');
    if (error) throw error;
    return NextResponse.json({ events: (data || []).map(serializeLink) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  let run: any = null;
  let userId = '';
  try {
    userId = await requireUser(request);
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid calendar event request' }, { status: 400 });
    const { data: commitment, error } = await getSupabaseAdmin().from('commitments').select('*')
      .eq('user_id', userId).eq('id', parsed.data.commitmentId).maybeSingle();
    if (error) throw error;
    if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 });
    if (!commitment.due_at) return NextResponse.json({ error: 'Add a due date before creating a reminder' }, { status: 400 });
    if (!['active', 'needs_review'].includes(commitment.status)) {
      return NextResponse.json({ error: 'Only open commitments can be added to a calendar' }, { status: 409 });
    }
    const connection = await getCalendarConnection(userId, commitment.account_id);
    if (!connection) return NextResponse.json({ error: 'Connect this account calendar first', code: 'CALENDAR_NOT_CONNECTED' }, { status: 409 });
    const { data: existing } = await getSupabaseAdmin().from('calendar_event_links').select('*')
      .eq('user_id', userId).eq('commitment_id', commitment.id).eq('status', 'active').maybeSingle();
    if (existing) return NextResponse.json({ event: serializeLink(existing), alreadyExists: true });

    run = await createAgentRun({
      userId, accountId: commitment.account_id, agentType: 'calendar_event_create',
      sourceType: 'commitment', sourceId: commitment.id, status: 'running',
      title: `Add “${commitment.title}” to calendar`,
      inputManifest: { commitmentId: commitment.id, dueAt: commitment.due_at, reminderMinutes: parsed.data.reminderMinutes },
    });
    const startsAt = commitment.due_at;
    const endsAt = new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString();
    const providerEvent = await createProviderCalendarEvent(connection, {
      title: commitment.title,
      description: commitment.description || `Relay reminder for: ${commitment.title}`,
      startsAt, endsAt, timezone: commitment.timezone || 'UTC',
      reminderMinutes: parsed.data.reminderMinutes,
    });
    const { data: link, error: insertError } = await getSupabaseAdmin().from('calendar_event_links').insert({
      user_id: userId, account_id: commitment.account_id, connection_id: connection.id,
      commitment_id: commitment.id, provider: connection.provider,
      provider_calendar_id: providerEvent.calendarId, provider_event_id: providerEvent.eventId,
      title: commitment.title, starts_at: startsAt, ends_at: endsAt,
      timezone: commitment.timezone || 'UTC',
    }).select('*').single();
    if (insertError) throw insertError;
    await finishAgentRun({
      userId, agentRunId: run.id, status: 'completed',
      summary: `Calendar reminder created for ${new Date(startsAt).toLocaleString()}.`,
      outputManifest: { calendarEventLinkId: link.id, providerEventId: providerEvent.eventId },
    });
    return NextResponse.json({ event: serializeLink(link) }, { status: 201 });
  } catch (error) {
    if (run && userId) {
      await finishAgentRun({
        userId, agentRunId: run.id, status: 'failed',
        summary: 'Calendar reminder could not be created.',
        errorMessage: error instanceof Error ? error.message : 'Unknown calendar error',
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

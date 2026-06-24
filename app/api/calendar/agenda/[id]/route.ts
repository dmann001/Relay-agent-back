import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAgentRun, finishAgentRun } from '@/lib/server/agent-activity';
import { handleApiError } from '@/lib/server/api-utils';
import { getCalendarConnection } from '@/lib/server/calendar-connections';
import { deleteProviderCalendarEvent, updateProviderCalendarEvent } from '@/lib/server/calendar-events';
import { requireUser } from '@/lib/server/supabase-admin';

const emailSchema = z.string().trim().email().max(320);

const updateSchema = z.object({
  accountId: z.string().uuid(),
  calendarId: z.string().trim().min(1).max(512).default('primary'),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80).default('UTC'),
  attendees: z.array(emailSchema).max(50).default([]),
  location: z.string().trim().max(300).optional(),
  reminderMinutes: z.number().int().min(0).max(40320).optional(),
});

async function requireConnection(request: NextRequest, accountId: string) {
  const userId = await requireUser(request);
  const connection = await getCalendarConnection(userId, accountId);
  if (!connection) {
    return {
      userId,
      response: NextResponse.json(
        { error: 'Connect calendar access for this account first', code: 'CALENDAR_NOT_CONNECTED' },
        { status: 409 },
      ),
    };
  }
  return { userId, connection };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let run: Awaited<ReturnType<typeof createAgentRun>> | null = null;
  let userId = '';
  try {
    const { id } = await context.params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid calendar event update', details: parsed.error.flatten() }, { status: 400 });
    }
    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: 'Event end time must be after the start time' }, { status: 400 });
    }

    const auth = await requireConnection(request, parsed.data.accountId);
    userId = auth.userId;
    if ('response' in auth) return auth.response;

    run = await createAgentRun({
      userId,
      accountId: parsed.data.accountId,
      agentType: 'calendar_event_update',
      sourceType: 'calendar_event',
      sourceId: id,
      status: 'running',
      title: `Update calendar event: ${parsed.data.title}`,
      inputManifest: parsed.data,
    });

    const providerEvent = await updateProviderCalendarEvent(auth.connection, parsed.data.calendarId, id, {
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: parsed.data.timezone,
      attendees: parsed.data.attendees,
      location: parsed.data.location,
      reminderMinutes: parsed.data.reminderMinutes,
    });

    await finishAgentRun({
      userId,
      agentRunId: run.id,
      status: 'completed',
      summary: 'Calendar event updated.',
      outputManifest: providerEvent,
    });

    return NextResponse.json({
      event: {
        id,
        accountId: parsed.data.accountId,
        accountEmail: null,
        provider: auth.connection.provider,
        calendarId: parsed.data.calendarId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: parsed.data.timezone,
        attendees: parsed.data.attendees,
        location: parsed.data.location || null,
        meetingUrl: providerEvent.meetingUrl,
        htmlLink: providerEvent.htmlLink,
      },
    });
  } catch (error) {
    if (run && userId) {
      await finishAgentRun({
        userId,
        agentRunId: run.id,
        status: 'failed',
        summary: 'Calendar event could not be updated.',
        errorMessage: error instanceof Error ? error.message : 'Unknown calendar error',
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let run: Awaited<ReturnType<typeof createAgentRun>> | null = null;
  let userId = '';
  try {
    const { id } = await context.params;
    const accountId = request.nextUrl.searchParams.get('accountId') || '';
    const calendarId = request.nextUrl.searchParams.get('calendarId') || 'primary';
    if (!z.string().uuid().safeParse(accountId).success) {
      return NextResponse.json({ error: 'Calendar account is required' }, { status: 400 });
    }

    const auth = await requireConnection(request, accountId);
    userId = auth.userId;
    if ('response' in auth) return auth.response;

    run = await createAgentRun({
      userId,
      accountId,
      agentType: 'calendar_event_delete',
      sourceType: 'calendar_event',
      sourceId: id,
      status: 'running',
      title: 'Delete calendar event',
      inputManifest: { calendarId, eventId: id },
    });

    await deleteProviderCalendarEvent(auth.connection, calendarId, id);
    await finishAgentRun({
      userId,
      agentRunId: run.id,
      status: 'completed',
      summary: 'Calendar event deleted.',
      outputManifest: { calendarId, eventId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (run && userId) {
      await finishAgentRun({
        userId,
        agentRunId: run.id,
        status: 'failed',
        summary: 'Calendar event could not be deleted.',
        errorMessage: error instanceof Error ? error.message : 'Unknown calendar error',
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

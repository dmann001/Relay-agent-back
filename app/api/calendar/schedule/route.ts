import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAgentRun, finishAgentRun } from '@/lib/server/agent-activity';
import { handleApiError } from '@/lib/server/api-utils';
import { getCalendarConnection, listCalendarConnections } from '@/lib/server/calendar-connections';
import { createProviderCalendarEvent } from '@/lib/server/calendar-events';
import { listEmailAccounts } from '@/lib/server/email-accounts';
import { requireUser } from '@/lib/server/supabase-admin';

const emailSchema = z.string().trim().email().max(320);

const scheduleSchema = z.object({
  accountId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80).default('UTC'),
  attendees: z.array(emailSchema).max(50).default([]),
  location: z.string().trim().max(300).optional(),
  reminderMinutes: z.number().int().min(0).max(40320).default(30),
  createConference: z.boolean().default(true),
  sourceMessageId: z.string().trim().max(256).optional(),
});

function inferAccountId(connections: Awaited<ReturnType<typeof listCalendarConnections>>, requested?: string) {
  const active = connections.filter((connection) => connection.status === 'connected');
  if (requested) return active.find((connection) => connection.account_id === requested)?.account_id || null;
  return active.length === 1 ? active[0].account_id : null;
}

export async function POST(request: NextRequest) {
  let run: Awaited<ReturnType<typeof createAgentRun>> | null = null;
  let userId = '';
  try {
    userId = await requireUser(request);
    const parsed = scheduleSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid meeting request', details: parsed.error.flatten() }, { status: 400 });
    }
    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: 'Meeting end time must be after the start time' }, { status: 400 });
    }

    const [connections, accounts] = await Promise.all([
      listCalendarConnections(userId),
      listEmailAccounts(userId),
    ]);
    const accountId = inferAccountId(connections, parsed.data.accountId);
    if (!accountId) {
      return NextResponse.json({
        error: parsed.data.accountId
          ? 'Connect calendar access for this account first'
          : 'Choose which connected calendar account should create this meeting',
        code: parsed.data.accountId ? 'CALENDAR_NOT_CONNECTED' : 'ACCOUNT_REQUIRED',
      }, { status: 409 });
    }
    const account = accounts.find(({ id }) => id === accountId);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const connection = await getCalendarConnection(userId, accountId);
    if (!connection) {
      return NextResponse.json({ error: 'Connect calendar access for this account first', code: 'CALENDAR_NOT_CONNECTED' }, { status: 409 });
    }

    run = await createAgentRun({
      userId,
      accountId,
      agentType: 'calendar_event_create',
      sourceType: parsed.data.sourceMessageId ? 'email' : 'meeting',
      sourceId: parsed.data.sourceMessageId,
      status: 'running',
      title: `Create meeting: ${parsed.data.title}`,
      inputManifest: {
        ...parsed.data,
        provider: connection.provider,
        accountEmail: account.email,
      },
    });

    const providerEvent = await createProviderCalendarEvent(connection, {
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: parsed.data.timezone,
      reminderMinutes: parsed.data.reminderMinutes,
      attendees: parsed.data.attendees,
      location: parsed.data.location,
      createConference: parsed.data.createConference,
    });

    await finishAgentRun({
      userId,
      agentRunId: run.id,
      status: 'completed',
      summary: `Meeting created on ${account.email}.`,
      outputManifest: {
        provider: connection.provider,
        providerEventId: providerEvent.eventId,
        meetingUrl: providerEvent.meetingUrl,
        htmlLink: providerEvent.htmlLink,
      },
    });

    return NextResponse.json({
      event: {
        id: providerEvent.eventId,
        accountId,
        accountEmail: account.email,
        provider: connection.provider,
        calendarId: providerEvent.calendarId,
        title: parsed.data.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: parsed.data.timezone,
        attendees: parsed.data.attendees,
        location: parsed.data.location || null,
        meetingUrl: providerEvent.meetingUrl,
        htmlLink: providerEvent.htmlLink,
      },
    }, { status: 201 });
  } catch (error) {
    if (run && userId) {
      await finishAgentRun({
        userId,
        agentRunId: run.id,
        status: 'failed',
        summary: 'Meeting could not be created.',
        errorMessage: error instanceof Error ? error.message : 'Unknown calendar error',
      }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

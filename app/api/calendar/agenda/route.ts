import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api-utils';
import { listCalendarConnections } from '@/lib/server/calendar-connections';
import { listProviderCalendarEvents } from '@/lib/server/calendar-events';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

const defaultRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start: start.toISOString(), end: end.toISOString() };
};

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const range = defaultRange();
    const rangeStart = params.get('start') || range.start;
    const rangeEnd = params.get('end') || range.end;
    const accountId = params.get('accountId') || undefined;

    const connections = (await listCalendarConnections(userId))
      .filter((connection) => connection.status === 'connected')
      .filter((connection) => !accountId || connection.account_id === accountId);
    const accountIds = connections.map(({ account_id }) => account_id);
    const { data: accounts, error } = accountIds.length
      ? await getSupabaseAdmin().from('email_accounts').select('id, email, provider')
        .eq('user_id', userId).in('id', accountIds)
      : { data: [], error: null };
    if (error) throw error;
    const accountById = new Map((accounts || []).map((account) => [account.id, account]));

    const settled = await Promise.allSettled(
      connections.map(async (connection) => {
        const events = await listProviderCalendarEvents(connection, rangeStart, rangeEnd);
        const account = accountById.get(connection.account_id);
        return events.map((event) => ({
          ...event,
          accountEmail: account?.email || null,
        }));
      }),
    );

    const events = settled
      .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const errors = settled
      .map((result, index) => result.status === 'rejected'
        ? {
            accountId: connections[index]?.account_id,
            message: result.reason instanceof Error ? result.reason.message : 'Calendar sync failed',
          }
        : null)
      .filter(Boolean);

    return NextResponse.json({ events, errors });
  } catch (error) {
    return handleApiError(error);
  }
}

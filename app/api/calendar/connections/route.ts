import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api-utils';
import { listCalendarConnections, serializeCalendarConnection } from '@/lib/server/calendar-connections';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const connections = await listCalendarConnections(userId);
    const accountIds = connections.map(({ account_id }) => account_id);
    const { data: accounts, error } = accountIds.length
      ? await getSupabaseAdmin().from('email_accounts').select('id, email')
        .eq('user_id', userId).in('id', accountIds)
      : { data: [], error: null };
    if (error) throw error;
    const accountById = new Map((accounts || []).map((account) => [account.id, account]));
    return NextResponse.json({
      connections: connections.map((connection) =>
        serializeCalendarConnection(connection, accountById.get(connection.account_id))),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

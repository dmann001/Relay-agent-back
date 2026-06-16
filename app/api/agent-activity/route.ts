import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { AGENT_RUN_STATUSES, serializeAgentRun } from '@/lib/server/agent-activity';

const querySchema = z.object({
  status: z.enum(AGENT_RUN_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = querySchema.safeParse({
      status: request.nextUrl.searchParams.get('status') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid agent activity filters' }, { status: 400 });
    }

    let query = getSupabaseAdmin()
      .from('agent_runs')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(parsed.data.limit);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);

    const { data: runs, error } = await query;
    if (error) throw error;

    const accountIds = [...new Set((runs || []).map((run) => run.account_id).filter(Boolean))];
    const { data: accounts, error: accountError } = accountIds.length
      ? await getSupabaseAdmin()
          .from('email_accounts')
          .select('id, email, provider')
          .eq('user_id', userId)
          .in('id', accountIds)
      : { data: [], error: null };
    if (accountError) throw accountError;
    const accountById = new Map((accounts || []).map((account) => [account.id, account]));

    const needsAttention = (runs || []).filter((run) =>
      ['awaiting_approval', 'needs_input', 'partially_completed', 'failed'].includes(run.status)
    ).length;

    return NextResponse.json({
      activities: (runs || []).map((run) => serializeAgentRun(run, accountById.get(run.account_id))),
      needsAttention,
    });
  } catch (error) {
    return handleApiError(error);
  }
}


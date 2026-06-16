import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { appendAgentActivityEvent, serializeAgentRun } from '@/lib/server/agent-activity';

const actionSchema = z.object({ action: z.enum(['cancel', 'retry']) });

async function ownedRun(userId: string, id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('agent_runs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id } = await context.params;
    const run = await ownedRun(userId, id);
    if (!run) return NextResponse.json({ error: 'Agent activity not found' }, { status: 404 });

    const [{ data: events, error: eventsError }, { data: account, error: accountError }] = await Promise.all([
      getSupabaseAdmin().from('agent_activity_events').select('*')
        .eq('user_id', userId).eq('agent_run_id', id).order('created_at', { ascending: true }),
      run.account_id
        ? getSupabaseAdmin().from('email_accounts').select('email, provider')
            .eq('user_id', userId).eq('id', run.account_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (eventsError) throw eventsError;
    if (accountError) throw accountError;

    return NextResponse.json({
      activity: serializeAgentRun(run, account),
      events: (events || []).map((event) => ({
        id: event.id,
        eventType: event.event_type,
        stage: event.stage,
        message: event.message,
        metadata: event.metadata,
        createdAt: event.created_at,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id } = await context.params;
    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid agent activity action' }, { status: 400 });

    const run = await ownedRun(userId, id);
    if (!run) return NextResponse.json({ error: 'Agent activity not found' }, { status: 404 });

    if (parsed.data.action === 'cancel') {
      if (!['draft', 'awaiting_approval', 'scheduled', 'queued', 'running', 'needs_input'].includes(run.status)) {
        return NextResponse.json({ error: 'This agent activity can no longer be cancelled' }, { status: 409 });
      }
      const { data, error } = await getSupabaseAdmin().from('agent_runs').update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        current_stage: null,
      }).eq('id', id).eq('user_id', userId).select('*').single();
      if (error) throw error;
      await appendAgentActivityEvent({
        userId, agentRunId: id, eventType: 'cancelled', message: 'Agent action cancelled by the user.',
      });
      return NextResponse.json({ activity: serializeAgentRun(data) });
    }

    if (!['failed', 'partially_completed', 'cancelled'].includes(run.status)) {
      return NextResponse.json({ error: 'Only failed, partial, or cancelled activities can be retried' }, { status: 409 });
    }
    if (run.attempt_count >= run.max_attempts) {
      return NextResponse.json({ error: 'This agent activity has reached its retry limit' }, { status: 409 });
    }
    const { data, error } = await getSupabaseAdmin().from('agent_runs').update({
      status: 'queued',
      current_stage: null,
      progress_current: 0,
      started_at: null,
      completed_at: null,
      error_code: null,
      error_message: null,
      attempt_count: run.attempt_count + 1,
    }).eq('id', id).eq('user_id', userId).select('*').single();
    if (error) throw error;
    await appendAgentActivityEvent({
      userId, agentRunId: id, eventType: 'retried', message: 'Agent action queued for retry.',
      metadata: { attempt: data.attempt_count },
    });
    return NextResponse.json({ activity: serializeAgentRun(data) });
  } catch (error) {
    return handleApiError(error);
  }
}


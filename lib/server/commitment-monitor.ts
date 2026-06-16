import { appendAgentActivityEvent, createAgentRun, finishAgentRun } from './agent-activity';
import { getSupabaseAdmin } from './supabase-admin';

export async function runCommitmentMonitor(monitor: any) {
  const db = getSupabaseAdmin();
  const { data: commitment, error } = await db.from('commitments').select('*')
    .eq('id', monitor.commitment_id).eq('user_id', monitor.user_id).maybeSingle();
  if (error) throw error;
  if (!commitment || !['active', 'needs_review'].includes(commitment.status)) {
    await db.from('commitment_monitors').update({ status: 'paused', last_result: 'Commitment is no longer open.' })
      .eq('id', monitor.id);
    return { outcome: 'paused' };
  }

  const run = await createAgentRun({
    userId: monitor.user_id,
    accountId: monitor.account_id,
    agentType: 'commitment_monitor',
    sourceType: 'commitment',
    sourceId: commitment.id,
    status: 'running',
    title: `Check “${commitment.title}”`,
    inputManifest: { monitorId: monitor.id, checkedAfter: monitor.last_checked_at || commitment.confirmed_at },
  });
  await appendAgentActivityEvent({
    userId: monitor.user_id, agentRunId: run.id, eventType: 'started',
    stage: 'checking_thread', message: 'Checking the tracked thread for a new response or overdue deadline.',
  });

  try {
    const checkedAfter = monitor.last_checked_at || commitment.confirmed_at;
    let responseDetected = false;
    if (commitment.provider_thread_id) {
      let query = db.from('emails').select('id, from_email, received_at').eq('user_id', monitor.user_id)
        .eq('account_id', monitor.account_id).eq('provider_thread_id', commitment.provider_thread_id)
        .gt('received_at', checkedAfter).order('received_at', { ascending: false }).limit(10);
      if (commitment.owner_email) query = query.ilike('from_email', commitment.owner_email);
      const { data: replies, error: replyError } = await query;
      if (replyError) throw replyError;
      responseDetected = Boolean(replies?.length);
    }
    const overdue = Boolean(commitment.due_at && new Date(commitment.due_at).getTime() <= Date.now());
    const needsReview = responseDetected || overdue;
    const result = responseDetected
      ? 'A possible response arrived in the tracked thread.'
      : overdue ? 'The commitment reached its due date.' : 'No relevant change was detected.';
    if (needsReview) {
      await db.from('commitments').update({ status: 'needs_review', snoozed_until: null })
        .eq('id', commitment.id).eq('user_id', monitor.user_id);
    }
    const now = new Date();
    await db.from('commitment_monitors').update({
      last_checked_at: now.toISOString(),
      next_check_at: new Date(now.getTime() + monitor.cadence_hours * 3600_000).toISOString(),
      last_result: result,
    }).eq('id', monitor.id);
    await finishAgentRun({
      userId: monitor.user_id, agentRunId: run.id, status: 'completed', summary: result,
      outputManifest: { responseDetected, overdue, needsReview },
    });
    return { outcome: needsReview ? 'needs_review' : 'unchanged' };
  } catch (error) {
    await finishAgentRun({
      userId: monitor.user_id, agentRunId: run.id, status: 'failed',
      summary: 'Commitment check failed.',
      errorMessage: error instanceof Error ? error.message : 'Unknown monitoring error',
    });
    throw error;
  }
}

export async function runDueCommitmentMonitors(limit = 25) {
  const { data, error } = await getSupabaseAdmin().from('commitment_monitors').select('*')
    .eq('status', 'active').lte('next_check_at', new Date().toISOString())
    .order('next_check_at').limit(limit);
  if (error) throw error;
  const results = [];
  for (const monitor of data || []) {
    try {
      results.push({ id: monitor.id, ...(await runCommitmentMonitor(monitor)) });
    } catch (error) {
      results.push({ id: monitor.id, outcome: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  return results;
}

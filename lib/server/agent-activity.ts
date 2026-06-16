import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const AGENT_RUN_STATUSES = [
  'draft',
  'awaiting_approval',
  'scheduled',
  'queued',
  'running',
  'needs_input',
  'completed',
  'partially_completed',
  'failed',
  'cancelled',
] as const;

export type AgentRunStatus = typeof AGENT_RUN_STATUSES[number];

export const AGENT_TYPES = [
  'commitment_monitor',
  'calendar_event_create',
  'calendar_event_update',
  'calendar_event_delete',
  'meeting_brief_prepare',
  'meeting_brief_refresh',
] as const;

export type AgentType = typeof AGENT_TYPES[number];

export interface CreateAgentRunInput {
  userId: string;
  accountId?: string;
  agentType: AgentType;
  title: string;
  summary?: string;
  sourceType?: 'email' | 'thread' | 'commitment' | 'calendar_event' | 'meeting';
  sourceId?: string;
  status?: AgentRunStatus;
  scheduledFor?: string;
  idempotencyKey?: string;
  inputManifest?: Record<string, unknown>;
}

export async function createAgentRun(input: CreateAgentRunInput) {
  const status = input.status ?? (input.scheduledFor ? 'scheduled' : 'queued');
  const { data, error } = await getSupabaseAdmin().from('agent_runs').insert({
    user_id: input.userId,
    account_id: input.accountId ?? null,
    agent_type: input.agentType,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
    title: input.title,
    summary: input.summary ?? '',
    status,
    scheduled_for: input.scheduledFor ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    input_manifest: input.inputManifest ?? {},
  }).select('*').single();
  if (error) throw error;

  await appendAgentActivityEvent({
    userId: input.userId,
    agentRunId: data.id,
    eventType: status === 'scheduled' ? 'scheduled' : 'created',
    message: status === 'scheduled' ? 'Agent action scheduled.' : 'Agent action created.',
  });
  return data;
}

export async function appendAgentActivityEvent(input: {
  userId: string;
  agentRunId: string;
  eventType: 'created' | 'scheduled' | 'started' | 'stage' | 'input_required' | 'completed' | 'failed' | 'cancelled' | 'retried';
  message: string;
  stage?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await getSupabaseAdmin().from('agent_activity_events').insert({
    user_id: input.userId,
    agent_run_id: input.agentRunId,
    event_type: input.eventType,
    stage: input.stage ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function finishAgentRun(input: {
  userId: string;
  agentRunId: string;
  status: 'completed' | 'failed';
  summary: string;
  outputManifest?: Record<string, unknown>;
  errorMessage?: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin().from('agent_runs').update({
    status: input.status,
    summary: input.summary,
    current_stage: input.status === 'completed' ? 'done' : 'failed',
    completed_at: now,
    output: input.outputManifest ?? {},
    error_message: input.errorMessage ?? null,
  }).eq('id', input.agentRunId).eq('user_id', input.userId).select('*').single();
  if (error) throw error;
  await appendAgentActivityEvent({
    userId: input.userId,
    agentRunId: input.agentRunId,
    eventType: input.status,
    message: input.summary,
    stage: input.status === 'completed' ? 'done' : 'failed',
  });
  return data;
}

export function serializeAgentRun(row: any, account?: { email: string; provider: string } | null) {
  return {
    id: row.id,
    accountId: row.account_id,
    accountEmail: account?.email ?? null,
    provider: account?.provider ?? null,
    agentType: row.agent_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    currentStage: row.current_stage,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    output: row.output ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

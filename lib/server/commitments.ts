import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const COMMITMENT_TYPES = [
  'my_task',
  'waiting_for_reply',
  'waiting_for_artifact',
  'follow_up',
] as const;

export const COMMITMENT_STATUSES = [
  'active',
  'needs_review',
  'satisfied',
  'dismissed',
  'expired',
] as const;

export function serializeCommitment(row: any, account?: { email: string; provider: string } | null) {
  return {
    id: row.id,
    accountId: row.account_id,
    accountEmail: account?.email ?? null,
    provider: row.provider ?? account?.provider ?? null,
    sourceEmailId: row.source_email_id,
    sourceThreadId: row.source_thread_id,
    providerMessageId: row.provider_message_id,
    providerThreadId: row.provider_thread_id,
    type: row.type,
    title: row.title,
    description: row.description,
    expectedOutcome: row.expected_outcome,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    dueAt: row.due_at,
    timezone: row.timezone,
    evidence: row.evidence,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    confirmedAt: row.confirmed_at,
    satisfiedAt: row.satisfied_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOwnedCommitment(userId: string, id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('commitments')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}


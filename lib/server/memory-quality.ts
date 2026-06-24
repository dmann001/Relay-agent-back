import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export type MemoryType = 'preference' | 'style' | 'contact' | 'project' | 'recent_context' | 'fact';
export type MemoryScope = 'global' | 'account' | 'contact';

export const MEMORY_CONFIDENCE_THRESHOLDS: Record<MemoryType, number> = {
  style: 0.55,
  contact: 0.55,
  preference: 0.65,
  project: 0.75,
  recent_context: 0.75,
  fact: 0.75,
};

const SENSITIVE_PATTERNS = [
  /\b(one[-\s]?time password|otp|verification code|auth(?:entication)? code)\b/i,
  /\bpassword\b/i,
  /\breset link\b/i,
  /\bhttps?:\/\/\S*(?:token|code|reset|verify|auth)\S*/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]*?){13,19}\b/,
];

export function containsSensitiveMemoryText(value: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

export function canonicalMemoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(user|relay|ai|generated|drafts?|emails?|replies?|may|might|tends?|prefers?|preference)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function memoryFingerprint(params: { type: MemoryType; text: string }): string {
  const canonical = canonicalMemoryText(params.text);
  const hash = createHash('sha256').update(`${params.type}:${canonical}`).digest('hex').slice(0, 32);
  return `${params.type}:${hash}`;
}

export function meetsMemoryConfidenceThreshold(type: MemoryType, confidence?: number | null): boolean {
  return Number(confidence ?? 0) >= MEMORY_CONFIDENCE_THRESHOLDS[type];
}

export async function createPendingMemorySuggestion(params: {
  userId: string;
  accountId?: string | null;
  contactId?: string | null;
  emailId?: string | null;
  threadId?: string | null;
  type: MemoryType;
  scope: MemoryScope;
  text: string;
  source: string;
  confidence: number;
  metadata?: Record<string, unknown>;
  expiresAt?: string | null;
}) {
  const text = params.text.trim();
  if (!text || containsSensitiveMemoryText(text)) return null;
  if (!meetsMemoryConfidenceThreshold(params.type, params.confidence)) return null;

  const fingerprint = memoryFingerprint({ type: params.type, text });
  const supabase = getSupabaseAdmin();
  let duplicateQuery = supabase
    .from('memory_items')
    .select('id, status, confidence, occurrence_count, metadata')
    .eq('user_id', params.userId)
    .eq('type', params.type)
    .eq('fingerprint', fingerprint)
    .in('status', ['pending', 'accepted'])
    .limit(1);

  duplicateQuery = params.accountId
    ? duplicateQuery.eq('account_id', params.accountId)
    : duplicateQuery.is('account_id', null);
  duplicateQuery = params.contactId
    ? duplicateQuery.eq('contact_id', params.contactId)
    : duplicateQuery.is('contact_id', null);

  const { data: duplicates, error: duplicateError } = await duplicateQuery;
  if (duplicateError && duplicateError.code !== '42P01') throw duplicateError;
  const duplicate = duplicates?.[0];
  if (duplicate?.status === 'accepted') return null;

  if (duplicate?.status === 'pending') {
    const occurrenceCount = Number(duplicate.occurrence_count || 1) + 1;
    const metadata = {
      ...(duplicate.metadata && typeof duplicate.metadata === 'object' ? duplicate.metadata : {}),
      ...(params.metadata || {}),
      mergedSuggestionCount: occurrenceCount,
    };
    const { data, error } = await supabase
      .from('memory_items')
      .update({
        confidence: Math.max(Number(duplicate.confidence || 0), params.confidence),
        occurrence_count: occurrenceCount,
        last_seen_at: new Date().toISOString(),
        metadata,
      })
      .eq('user_id', params.userId)
      .eq('id', duplicate.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('memory_items')
    .insert({
      user_id: params.userId,
      account_id: params.accountId || null,
      contact_id: params.contactId || null,
      email_id: params.emailId || null,
      thread_id: params.threadId || null,
      type: params.type,
      scope: params.scope,
      status: 'pending',
      text,
      source: params.source,
      confidence: params.confidence,
      fingerprint,
      occurrence_count: 1,
      last_seen_at: new Date().toISOString(),
      expires_at: params.expiresAt || null,
      metadata: {
        ...(params.metadata || {}),
        requiresConfirmation: true,
      },
    })
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data;
}

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { normalizeEmailAddress } from '@/lib/server/personalization';

type ContactSuggestion = {
  id?: string;
  email: string;
  displayName?: string;
  source: 'contacts' | 'email_metadata';
  score: number;
  lastSeenAt?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const query = sanitizeSearchQuery(params.get('q') || '');
    const accountId = params.get('accountId') || undefined;
    const limit = Math.min(Math.max(parseInt(params.get('limit') || '12', 10) || 12, 1), 30);

    const contacts = await searchContacts(userId, query, limit);
    const metadataContacts = await searchEmailMetadata(userId, query, accountId, limit);
    const merged = mergeContacts([...contacts, ...metadataContacts], query).slice(0, limit);

    return NextResponse.json({ contacts: merged });
  } catch (error) {
    return handleApiError(error);
  }
}

async function searchContacts(userId: string, query: string, limit: number): Promise<ContactSuggestion[]> {
  let builder = getSupabaseAdmin()
    .from('contacts')
    .select('id, email, display_name, last_seen_at, metadata')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (query) {
    builder = builder.or(`email.ilike.%${escapeLike(query)}%,display_name.ilike.%${escapeLike(query)}%`);
  }

  const { data, error } = await builder;
  if (error && error.code !== '42P01') throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || undefined,
    source: 'contacts' as const,
    score: Number(row.metadata?.stats?.outboundCount || 0) + 20,
    lastSeenAt: row.last_seen_at,
  }));
}

async function searchEmailMetadata(
  userId: string,
  query: string,
  accountId: string | undefined,
  limit: number,
): Promise<ContactSuggestion[]> {
  let builder = getSupabaseAdmin()
    .from('emails')
    .select('from_name, from_email, to_recipients, received_at')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(80);

  if (accountId) builder = builder.eq('account_id', accountId);

  const { data, error } = await builder;
  if (error) throw error;

  const suggestions: ContactSuggestion[] = [];
  for (const row of data || []) {
    if (row.from_email) {
      suggestions.push({
        email: row.from_email,
        displayName: row.from_name || undefined,
        source: 'email_metadata',
        score: 5,
        lastSeenAt: row.received_at,
      });
    }
    for (const recipient of Array.isArray(row.to_recipients) ? row.to_recipients : []) {
      const email = normalizeEmailAddress(recipient?.email || recipient);
      if (!email) continue;
      suggestions.push({
        email,
        displayName: recipient?.name || undefined,
        source: 'email_metadata',
        score: 4,
        lastSeenAt: row.received_at,
      });
    }
  }

  if (!query) return suggestions;
  return suggestions.filter((item) => {
    const haystack = `${item.displayName || ''} ${item.email}`.toLowerCase();
    return haystack.includes(query);
  }).slice(0, limit * 2);
}

function mergeContacts(rows: ContactSuggestion[], query: string): ContactSuggestion[] {
  const byEmail = new Map<string, ContactSuggestion>();
  for (const row of rows) {
    const email = normalizeEmailAddress(row.email);
    if (!email) continue;
    const current = byEmail.get(email);
    const startsWithBoost = query && (`${row.displayName || ''} ${email}`.toLowerCase().startsWith(query) || email.startsWith(query)) ? 30 : 0;
    const candidate = {
      ...row,
      email,
      score: row.score + startsWithBoost,
    };
    if (!current || candidate.score > current.score) byEmail.set(email, candidate);
  }
  return [...byEmail.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime();
  });
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function sanitizeSearchQuery(value: string) {
  return value.trim().toLowerCase().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

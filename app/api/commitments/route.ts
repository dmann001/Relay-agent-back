import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { getEmailAccount } from '@/lib/server/email-accounts';
import { handleApiError } from '@/lib/server/api-utils';
import { COMMITMENT_STATUSES, COMMITMENT_TYPES, serializeCommitment } from '@/lib/server/commitments';

const listSchema = z.object({
  status: z.enum(COMMITMENT_STATUSES).optional(),
  accountId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const createSchema = z.object({
  accountId: z.string().uuid(),
  providerMessageId: z.string().trim().min(1).max(512),
  type: z.enum(COMMITMENT_TYPES),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).default(''),
  expectedOutcome: z.string().trim().max(2000).default(''),
  ownerName: z.string().trim().max(200).default(''),
  ownerEmail: z.string().trim().email().max(320).or(z.literal('')).default(''),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
  evidence: z.string().trim().max(4000).default(''),
});

async function accountsForRows(userId: string, rows: any[]) {
  const accountIds = [...new Set(rows.map(({ account_id }) => account_id).filter(Boolean))];
  if (!accountIds.length) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from('email_accounts')
    .select('id, email, provider')
    .eq('user_id', userId)
    .in('id', accountIds);
  if (error) throw error;
  return new Map((data || []).map((account) => [account.id, account]));
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = listSchema.safeParse({
      status: request.nextUrl.searchParams.get('status') || undefined,
      accountId: request.nextUrl.searchParams.get('accountId') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid commitment filters' }, { status: 400 });

    let query = getSupabaseAdmin().from('commitments').select('*')
      .eq('user_id', userId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(parsed.data.limit);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);
    if (parsed.data.accountId) query = query.eq('account_id', parsed.data.accountId);

    const { data, error } = await query;
    if (error) throw error;
    const accountById = await accountsForRows(userId, data || []);
    const commitments = (data || []).map((row) => serializeCommitment(row, accountById.get(row.account_id)));
    const needsAttention = commitments.filter(({ status, dueAt, snoozedUntil }) => {
      if (status === 'needs_review') return true;
      if (status !== 'active' || !dueAt) return false;
      if (snoozedUntil && new Date(snoozedUntil).getTime() > Date.now()) return false;
      return new Date(dueAt).getTime() <= Date.now();
    }).length;
    return NextResponse.json({ commitments, needsAttention });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid commitment values', details: parsed.error.flatten() }, { status: 400 });
    }

    const account = await getEmailAccount(userId, parsed.data.accountId);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const { data: sourceEmail, error: sourceError } = await getSupabaseAdmin()
      .from('emails')
      .select('id, thread_id, provider, provider_message_id, provider_thread_id')
      .eq('user_id', userId)
      .eq('account_id', account.id)
      .eq('provider_message_id', parsed.data.providerMessageId)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceEmail) return NextResponse.json({ error: 'Source email not found in the synced mailbox' }, { status: 404 });

    const duplicateQuery = getSupabaseAdmin().from('commitments').select('id')
      .eq('user_id', userId)
      .eq('account_id', account.id)
      .eq('provider_message_id', sourceEmail.provider_message_id)
      .eq('title', parsed.data.title)
      .in('status', ['active', 'needs_review'])
      .limit(1);
    const { data: duplicates, error: duplicateError } = await duplicateQuery;
    if (duplicateError) throw duplicateError;
    if (duplicates?.length) {
      return NextResponse.json({ error: 'This commitment is already being tracked', code: 'DUPLICATE_COMMITMENT', commitmentId: duplicates[0].id }, { status: 409 });
    }

    const { data, error } = await getSupabaseAdmin().from('commitments').insert({
      user_id: userId,
      account_id: account.id,
      source_email_id: sourceEmail.id,
      source_thread_id: sourceEmail.thread_id,
      provider: sourceEmail.provider,
      provider_message_id: sourceEmail.provider_message_id,
      provider_thread_id: sourceEmail.provider_thread_id,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      expected_outcome: parsed.data.expectedOutcome,
      owner_name: parsed.data.ownerName,
      owner_email: parsed.data.ownerEmail || null,
      due_at: parsed.data.dueAt,
      timezone: parsed.data.timezone,
      evidence: parsed.data.evidence,
      status: 'active',
    }).select('*').single();
    if (error) throw error;

    return NextResponse.json({ commitment: serializeCommitment(data, account) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}


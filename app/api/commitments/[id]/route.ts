import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { COMMITMENT_TYPES, getOwnedCommitment, serializeCommitment } from '@/lib/server/commitments';

const updateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('dismiss') }),
  z.object({ action: z.literal('snooze'), until: z.string().datetime({ offset: true }) }),
  z.object({
    action: z.literal('update'),
    type: z.enum(COMMITMENT_TYPES).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).optional(),
    expectedOutcome: z.string().trim().max(2000).optional(),
    ownerName: z.string().trim().max(200).optional(),
    ownerEmail: z.string().trim().email().max(320).or(z.literal('')).optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  }),
]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id } = await context.params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid commitment action' }, { status: 400 });

    const current = await getOwnedCommitment(userId, id);
    if (!current) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 });

    const now = new Date().toISOString();
    let values: Record<string, unknown>;
    switch (parsed.data.action) {
      case 'complete':
        values = { status: 'satisfied', satisfied_at: now, dismissed_at: null, snoozed_until: null };
        break;
      case 'reopen':
        values = { status: 'active', satisfied_at: null, dismissed_at: null };
        break;
      case 'dismiss':
        values = { status: 'dismissed', dismissed_at: now, snoozed_until: null };
        break;
      case 'snooze':
        if (!['active', 'needs_review'].includes(current.status)) {
          return NextResponse.json({ error: 'Only active commitments can be snoozed' }, { status: 409 });
        }
        values = { snoozed_until: parsed.data.until };
        break;
      case 'update':
        values = {
          ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.expectedOutcome !== undefined ? { expected_outcome: parsed.data.expectedOutcome } : {}),
          ...(parsed.data.ownerName !== undefined ? { owner_name: parsed.data.ownerName } : {}),
          ...(parsed.data.ownerEmail !== undefined ? { owner_email: parsed.data.ownerEmail || null } : {}),
          ...(parsed.data.dueAt !== undefined ? { due_at: parsed.data.dueAt } : {}),
          ...(parsed.data.timezone !== undefined ? { timezone: parsed.data.timezone } : {}),
        };
        break;
    }

    const { data, error } = await getSupabaseAdmin().from('commitments').update(values)
      .eq('id', id).eq('user_id', userId).select('*').single();
    if (error) throw error;

    const { data: account, error: accountError } = data.account_id
      ? await getSupabaseAdmin().from('email_accounts').select('email, provider')
          .eq('id', data.account_id).eq('user_id', userId).maybeSingle()
      : { data: null, error: null };
    if (accountError) throw accountError;
    return NextResponse.json({ commitment: serializeCommitment(data, account) });
  } catch (error) {
    return handleApiError(error);
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/server/api-utils';
import { getOwnedCommitment } from '@/lib/server/commitments';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

const schema = z.object({ cadenceHours: z.number().int().min(1).max(168).default(24) });

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid monitoring cadence' }, { status: 400 });
    const commitment = await getOwnedCommitment(userId, id);
    if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 });
    if (!['active', 'needs_review'].includes(commitment.status)) {
      return NextResponse.json({ error: 'Only open commitments can be monitored' }, { status: 409 });
    }
    const initialCheck = commitment.due_at && new Date(commitment.due_at).getTime() > Date.now()
      ? commitment.due_at : new Date().toISOString();
    const { data, error } = await getSupabaseAdmin().from('commitment_monitors').upsert({
      user_id: userId, commitment_id: commitment.id, account_id: commitment.account_id,
      status: 'active', cadence_hours: parsed.data.cadenceHours, next_check_at: initialCheck,
    }, { onConflict: 'user_id,commitment_id' }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ monitor: serialize(data) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id } = await context.params;
    const { error } = await getSupabaseAdmin().from('commitment_monitors').delete()
      .eq('user_id', userId).eq('commitment_id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

function serialize(row: any) {
  return {
    id: row.id, commitmentId: row.commitment_id, status: row.status,
    cadenceHours: row.cadence_hours, nextCheckAt: row.next_check_at,
    lastCheckedAt: row.last_checked_at, lastResult: row.last_result,
  };
}

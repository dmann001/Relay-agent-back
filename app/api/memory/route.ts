import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/server/api-utils';
import { runMemoryMaintenance } from '@/lib/server/memory-maintenance';
import { memoryFingerprint, type MemoryType } from '@/lib/server/memory-quality';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  action: z.enum(['accept', 'reject', 'archive', 'update', 'resetProfile', 'setLearning']),
  text: z.string().trim().min(1).max(1000).optional(),
  learningEnabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const [memoryResult, profileResult] = await Promise.all([
      getSupabaseAdmin()
        .from('memory_items')
        .select('id, type, scope, status, text, source, confidence, fingerprint, occurrence_count, last_seen_at, superseded_by, metadata, expires_at, accepted_at, created_at, updated_at')
        .eq('user_id', userId)
        .in('status', ['pending', 'accepted'])
        .order('updated_at', { ascending: false })
        .limit(100),
      getSupabaseAdmin()
        .from('agent_memory')
        .select('writing_profile, recent_context, learning_enabled, confirmed_learning_only')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (memoryResult.error && memoryResult.error.code !== '42P01') throw memoryResult.error;
    if (profileResult.error && profileResult.error.code !== '42P01') throw profileResult.error;

    return NextResponse.json({
      memories: memoryResult.data || [],
      profile: profileResult.data || {
        writing_profile: {},
        recent_context: [],
        learning_enabled: true,
        confirmed_learning_only: true,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid memory update' }, { status: 400 });

    if (parsed.data.action === 'resetProfile') {
      const { error } = await getSupabaseAdmin().from('agent_memory').upsert({
        user_id: userId,
        writing_profile: {},
        recent_context: [],
        profile_version: 1,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === 'setLearning') {
      const { error } = await getSupabaseAdmin().from('agent_memory').upsert({
        user_id: userId,
        learning_enabled: parsed.data.learningEnabled ?? true,
        confirmed_learning_only: true,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (!parsed.data.id) return NextResponse.json({ error: 'Memory id is required' }, { status: 400 });
    if (parsed.data.action === 'update' && !parsed.data.text) {
      return NextResponse.json({ error: 'Memory text is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.action === 'accept') {
      updates.status = 'accepted';
      updates.accepted_at = new Date().toISOString();
    } else if (parsed.data.action === 'reject') {
      updates.status = 'rejected';
    } else if (parsed.data.action === 'archive') {
      updates.status = 'archived';
    } else if (parsed.data.action === 'update') {
      updates.text = parsed.data.text;
    }

    if (parsed.data.action === 'update' && parsed.data.text) {
      const { data: current, error: currentError } = await getSupabaseAdmin()
        .from('memory_items')
        .select('type')
        .eq('user_id', userId)
        .eq('id', parsed.data.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
      updates.fingerprint = memoryFingerprint({ type: current.type as MemoryType, text: parsed.data.text });
      updates.last_seen_at = new Date().toISOString();
    }

    const { data, error } = await getSupabaseAdmin()
      .from('memory_items')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', parsed.data.id)
      .select('id, type, scope, status, text, source, confidence, fingerprint, occurrence_count, last_seen_at, superseded_by, metadata, expires_at, accepted_at, created_at, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Memory not found' }, { status: 404 });

    if (['accept', 'archive', 'update'].includes(parsed.data.action)) {
      await runMemoryMaintenance(userId).catch((profileError) => {
        console.error('[Memory] Could not maintain memory profile:', profileError);
      });
    }

    return NextResponse.json({ memory: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Memory id is required' }, { status: 400 });

    const { error } = await getSupabaseAdmin()
      .from('memory_items')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    await runMemoryMaintenance(userId).catch((profileError) => {
      console.error('[Memory] Could not maintain memory profile:', profileError);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

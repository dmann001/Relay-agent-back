import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/server/api-utils';
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
        .select('id, type, scope, status, text, source, confidence, metadata, expires_at, accepted_at, created_at, updated_at')
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

    const { data, error } = await getSupabaseAdmin()
      .from('memory_items')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', parsed.data.id)
      .select('id, type, scope, status, text, source, confidence, metadata, expires_at, accepted_at, created_at, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Memory not found' }, { status: 404 });

    if (parsed.data.action === 'accept' && ['style', 'preference'].includes(data.type)) {
      await appendWritingProfileNote(userId, data.text).catch((profileError) => {
        console.error('[Memory] Could not compact accepted memory into profile:', profileError);
      });
    }

    return NextResponse.json({ memory: data });
  } catch (error) {
    return handleApiError(error);
  }
}

async function appendWritingProfileNote(userId: string, text: string) {
  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from('agent_memory')
    .select('writing_profile')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError && readError.code !== '42P01') throw readError;

  const profile = current?.writing_profile && typeof current.writing_profile === 'object'
    ? current.writing_profile as Record<string, unknown>
    : {};
  const existing = Array.isArray(profile.learnedStyleNotes)
    ? profile.learnedStyleNotes.map((item: unknown) => String(item))
    : [];
  const learnedStyleNotes = [text, ...existing.filter((item) => item !== text)].slice(0, 12);

  const { error } = await supabase.from('agent_memory').upsert({
    user_id: userId,
    writing_profile: {
      ...profile,
      learnedStyleNotes,
    },
    profile_version: Number(profile.profileVersion || 1) + 1,
  }, { onConflict: 'user_id' });
  if (error) throw error;
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

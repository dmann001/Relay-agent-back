import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

type MemoryRow = {
  id: string;
  type: string;
  status: string;
  text: string;
  fingerprint?: string | null;
  occurrence_count?: number | null;
  updated_at?: string | null;
  expires_at?: string | null;
  superseded_by?: string | null;
};

export interface MemoryMaintenanceResult {
  ok: true;
  compacted: boolean;
  archived: number;
  profileVersion: number;
}

function activeMemory(row: MemoryRow) {
  return !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
}

function learnedStyleNotes(rows: MemoryRow[]) {
  return rows
    .filter((row) => row.status === 'accepted')
    .filter(activeMemory)
    .filter((row) => ['style', 'preference'].includes(row.type))
    .sort((a, b) => {
      const occurrenceDelta = Number(b.occurrence_count || 1) - Number(a.occurrence_count || 1);
      if (occurrenceDelta !== 0) return occurrenceDelta;
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    })
    .map((row) => row.text.trim())
    .filter(Boolean)
    .filter((text, index, list) => list.indexOf(text) === index)
    .slice(0, 12);
}

function sameStringList(a: unknown, b: string[]) {
  return Array.isArray(a)
    && a.length === b.length
    && a.every((item, index) => String(item) === b[index]);
}

export async function runMemoryMaintenance(userId: string): Promise<MemoryMaintenanceResult> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error: readError } = await supabase
    .from('memory_items')
    .select('id, type, status, text, fingerprint, occurrence_count, updated_at, expires_at, superseded_by')
    .eq('user_id', userId)
    .in('status', ['pending', 'accepted'])
    .order('updated_at', { ascending: false });
  if (readError && readError.code !== '42P01') throw readError;

  const memories = (rows || []) as MemoryRow[];
  const archiveIds = new Set<string>();
  const supersededBy = new Map<string, string>();

  for (const row of memories) {
    if (!activeMemory(row) || row.superseded_by) archiveIds.add(row.id);
  }

  const acceptedByFingerprint = new Map<string, MemoryRow>();
  for (const row of memories.filter((item) => item.status === 'accepted' && item.fingerprint)) {
    if (archiveIds.has(row.id)) continue;
    const key = `${row.type}:${row.fingerprint}`;
    const existing = acceptedByFingerprint.get(key);
    if (!existing) {
      acceptedByFingerprint.set(key, row);
      continue;
    }
    const rowScore = Number(row.occurrence_count || 1);
    const existingScore = Number(existing.occurrence_count || 1);
    const rowTime = new Date(row.updated_at || 0).getTime();
    const existingTime = new Date(existing.updated_at || 0).getTime();
    const keepRow = rowScore > existingScore || (rowScore === existingScore && rowTime > existingTime);
    const keep = keepRow ? row : existing;
    const archive = keepRow ? existing : row;
    acceptedByFingerprint.set(key, keep);
    archiveIds.add(archive.id);
    supersededBy.set(archive.id, keep.id);
  }

  let archived = 0;
  if (archiveIds.size) {
    const ids = Array.from(archiveIds);
    const { error: archiveError } = await supabase
      .from('memory_items')
      .update({ status: 'archived' })
      .eq('user_id', userId)
      .in('id', ids);
    if (archiveError) throw archiveError;
    archived = ids.length;

    await Promise.all(Array.from(supersededBy.entries()).map(([id, targetId]) =>
      supabase
        .from('memory_items')
        .update({ superseded_by: targetId })
        .eq('user_id', userId)
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    ));
  }

  const { data: current, error: profileReadError } = await supabase
    .from('agent_memory')
    .select('writing_profile, profile_version')
    .eq('user_id', userId)
    .maybeSingle();
  if (profileReadError && profileReadError.code !== '42P01') throw profileReadError;

  const profile = current?.writing_profile && typeof current.writing_profile === 'object'
    ? current.writing_profile as Record<string, unknown>
    : {};
  const notes = learnedStyleNotes(memories.filter((row) => !archiveIds.has(row.id)));
  const currentVersion = Number(current?.profile_version || 1);
  const compacted = !sameStringList(profile.learnedStyleNotes, notes);
  const nextVersion = compacted ? currentVersion + 1 : currentVersion;

  if (compacted || !current) {
    const { error: upsertError } = await supabase
      .from('agent_memory')
      .upsert({
        user_id: userId,
        writing_profile: {
          ...profile,
          learnedStyleNotes: notes,
        },
        profile_version: nextVersion,
      }, { onConflict: 'user_id' });
    if (upsertError) throw upsertError;
  }

  return {
    ok: true,
    compacted,
    archived,
    profileVersion: nextVersion,
  };
}

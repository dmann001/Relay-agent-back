import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api-utils';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const { data, error } = await getSupabaseAdmin().from('commitment_monitors').select('*')
      .eq('user_id', userId).order('next_check_at');
    if (error) throw error;
    return NextResponse.json({ monitors: (data || []).map((row) => ({
      id: row.id, commitmentId: row.commitment_id, status: row.status,
      cadenceHours: row.cadence_hours, nextCheckAt: row.next_check_at,
      lastCheckedAt: row.last_checked_at, lastResult: row.last_result,
    })) });
  } catch (error) {
    return handleApiError(error);
  }
}

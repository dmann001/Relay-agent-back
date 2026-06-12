// Mailbox counts for the sidebar (computed from the DB metadata cache).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const supabase = getSupabaseAdmin();

    const countWhere = async (apply: (q: any) => any): Promise<number> => {
      const base = supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      const { count, error } = await apply(base);
      if (error) throw error;
      return count ?? 0;
    };

    const [inboxUnread, sent, archives, trash, drafts] = await Promise.all([
      countWhere((q) => q.eq('is_inbox', true).eq('is_trashed', false).eq('is_read', false)),
      countWhere((q) => q.eq('is_sent', true).eq('is_trashed', false)),
      countWhere((q) => q.eq('is_archived', true).eq('is_trashed', false)),
      countWhere((q) => q.eq('is_trashed', true)),
      (async () => {
        const { count, error } = await supabase
          .from('drafts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (error) throw error;
        return count ?? 0;
      })(),
    ]);

    return NextResponse.json({
      counts: { inboxUnread, sent, archives, trash, drafts },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

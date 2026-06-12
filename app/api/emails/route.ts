// Email list - served from the Relay DB metadata cache (fast path).
// The DB stores metadata only; bodies are fetched via /api/emails/[id].
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { EMAIL_ROW_COLUMNS, inboxHasMorePages, rowToEmail, type EmailRow } from '@/lib/server/email-sync';
import { handleApiError } from '@/lib/server/api-utils';

type ListMailbox = 'inbox' | 'sent' | 'archive' | 'trash';
const GMAIL_CATEGORIES = new Set(['primary', 'promotions', 'social', 'updates', 'forums']);

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const mailbox = (params.get('mailbox') || 'inbox') as ListMailbox;
    const requestedCategory = params.get('category');
    const category = requestedCategory && GMAIL_CATEGORIES.has(requestedCategory)
      ? requestedCategory
      : null;
    const limit = Math.min(parseInt(params.get('limit') || '50', 10) || 50, 200);
    const offset = Math.max(parseInt(params.get('offset') || '0', 10) || 0, 0);

    let query = getSupabaseAdmin()
      .from('emails')
      .select(EMAIL_ROW_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    switch (mailbox) {
      case 'sent':
        query = query.eq('is_sent', true).eq('is_trashed', false);
        break;
      case 'archive':
        query = query.eq('is_archived', true).eq('is_trashed', false);
        break;
      case 'trash':
        query = query.eq('is_trashed', true);
        break;
      case 'inbox':
      default:
        query = query.eq('is_inbox', true).eq('is_trashed', false);
        break;
    }

    if (mailbox === 'inbox' && category) {
      query = query.eq('gmail_category', category);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const hasMore = mailbox === 'inbox' ? await inboxHasMorePages(userId) : false;

    return NextResponse.json({
      emails: ((data || []) as unknown as EmailRow[]).map(rowToEmail),
      total: count ?? 0,
      mailbox,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

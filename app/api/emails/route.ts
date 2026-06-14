// Email list - served from the Relay DB metadata cache (fast path).
// The DB stores metadata only; bodies are fetched via /api/emails/[id].
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { EMAIL_ROW_COLUMNS, inboxHasMorePages, rowToEmail, type EmailRow, type GmailCategory } from '@/lib/server/email-sync';
import { handleApiError } from '@/lib/server/api-utils';

type ListMailbox = 'inbox' | 'sent' | 'archive' | 'trash';
const GMAIL_CATEGORIES = new Set(['primary', 'promotions', 'social', 'updates', 'forums']);

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const mailbox = (params.get('mailbox') || 'inbox') as ListMailbox;
    const requestedCategory = params.get('category');
    const accountId = params.get('accountId');
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

    if (accountId) {
      const { data: ownedAccount, error: accountError } = await getSupabaseAdmin()
        .from('email_accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', userId)
        .is('revoked_at', null)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!ownedAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      query = query.eq('account_id', accountId);
    }

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

    const hasMore = mailbox === 'inbox'
      ? await inboxHasMorePages(userId, category as GmailCategory | undefined, accountId || undefined)
      : false;
    let unreadTotal: number | undefined;
    if (mailbox === 'inbox') {
      let unreadQuery = getSupabaseAdmin().from('emails').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_inbox', true).eq('is_trashed', false).eq('is_read', false);
      if (category) unreadQuery = unreadQuery.eq('gmail_category', category);
      if (accountId) unreadQuery = unreadQuery.eq('account_id', accountId);
      const { count: unreadCount, error: unreadError } = await unreadQuery;
      if (unreadError) throw unreadError;
      unreadTotal = unreadCount || 0;
    }

    const accountIds = [...new Set(((data || []) as unknown as EmailRow[]).map((row) => row.account_id))];
    const { data: accountRows, error: accountsError } = accountIds.length
      ? await getSupabaseAdmin().from('email_accounts').select('id, email').eq('user_id', userId).in('id', accountIds)
      : { data: [], error: null };
    if (accountsError) throw accountsError;
    const accountEmails = new Map((accountRows || []).map((account) => [account.id, account.email]));

    return NextResponse.json({
      emails: ((data || []) as unknown as EmailRow[]).map((row) => ({ ...rowToEmail(row), accountEmail: accountEmails.get(row.account_id) })),
      total: count ?? 0,
      unreadTotal,
      mailbox,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

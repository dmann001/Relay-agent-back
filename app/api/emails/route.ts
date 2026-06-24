// Email list - served from the Relay DB metadata cache (fast path).
// The DB stores metadata only; bodies are fetched via /api/emails/[id].
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { EMAIL_ROW_COLUMNS, mailboxHasMorePages, rowToEmail, type EmailRow, type GmailCategory } from '@/lib/server/email-sync';
import { decodeEmailListCursor, encodeEmailListCursor } from '@/lib/server/email-pagination';
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
    const offsetParam = params.get('offset');
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);
    const cursorParam = params.get('cursor');
    const cursor = decodeEmailListCursor(cursorParam);
    if (cursorParam && !cursor) {
      return NextResponse.json({ error: 'Invalid email cursor', code: 'INVALID_CURSOR' }, { status: 400 });
    }
    let selectedProvider: 'gmail' | 'outlook' | null = null;

    let query = getSupabaseAdmin()
      .from('emails')
      .select(EMAIL_ROW_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('received_at', { ascending: false })
      .order('provider_message_id', { ascending: false });

    if (cursor) {
      query = query.or(
        `received_at.lt.${cursor.receivedAt},and(received_at.eq.${cursor.receivedAt},provider_message_id.lt.${cursor.providerMessageId})`
      );
    }

    if (accountId) {
      const { data: ownedAccount, error: accountError } = await getSupabaseAdmin()
        .from('email_accounts')
        .select('id, provider')
        .eq('id', accountId)
        .eq('user_id', userId)
        .is('revoked_at', null)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!ownedAccount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      selectedProvider = ownedAccount.provider;
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

    const applyInboxCategory = (categoryQuery: any) => {
      if (selectedProvider === 'outlook') return categoryQuery;
      if (category === 'primary') {
        return categoryQuery.or('provider.eq.outlook,gmail_category.eq.primary');
      }
      return category ? categoryQuery.eq('gmail_category', category) : categoryQuery;
    };

    if (mailbox === 'inbox') {
      query = applyInboxCategory(query);
    }

    query = offsetParam && !cursor
      ? query.range(offset, offset + limit)
      : query.limit(limit + 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = ((data || []) as unknown as EmailRow[]);
    const pageRows = rows.slice(0, limit);
    const cacheHasMore = rows.length > limit;
    const providerHasMore = await mailboxHasMorePages(
      userId,
      mailbox,
      mailbox === 'inbox' ? category as GmailCategory | undefined : undefined,
      accountId || undefined
    );
    const hasMore = cacheHasMore || providerHasMore;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = lastRow && hasMore
      ? encodeEmailListCursor({
        receivedAt: lastRow.received_at || new Date(0).toISOString(),
        providerMessageId: lastRow.provider_message_id,
      })
      : null;
    let unreadTotal: number | undefined;
    if (mailbox === 'inbox') {
      let unreadQuery = getSupabaseAdmin().from('emails').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_inbox', true).eq('is_trashed', false).eq('is_read', false);
      unreadQuery = applyInboxCategory(unreadQuery);
      if (accountId) unreadQuery = unreadQuery.eq('account_id', accountId);
      const { count: unreadCount, error: unreadError } = await unreadQuery;
      if (unreadError) throw unreadError;
      unreadTotal = unreadCount || 0;
    }

    const accountIds = [...new Set(pageRows.map((row) => row.account_id))];
    const { data: accountRows, error: accountsError } = accountIds.length
      ? await getSupabaseAdmin().from('email_accounts').select('id, email').eq('user_id', userId).in('id', accountIds)
      : { data: [], error: null };
    if (accountsError) throw accountsError;
    const accountEmails = new Map((accountRows || []).map((account) => [account.id, account.email]));

    return NextResponse.json({
      emails: pageRows.map((row) => ({ ...rowToEmail(row), accountEmail: accountEmails.get(row.account_id) })),
      total: count ?? 0,
      unreadTotal,
      mailbox,
      hasMore,
      cacheHasMore,
      providerHasMore,
      nextCursor,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

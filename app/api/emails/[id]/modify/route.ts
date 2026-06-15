// Email actions: archive / trash / read / star.
// Gmail is the source of truth - the action runs against the Gmail API first,
// then the DB metadata cache is updated from the labels Gmail returns.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts, getEmailAccount } from '@/lib/server/email-accounts';
import { modifyOutlookMessage } from '@/lib/server/outlook-api';
import { findAccountForMessage, refreshCachedMessage } from '@/lib/server/email-sync';
import { modifyMessage, trashMessage, untrashMessage } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';

const ACTIONS = [
  'archive',
  'unarchive',
  'trash',
  'untrash',
  'markRead',
  'markUnread',
  'star',
  'unstar',
] as const;

type Action = (typeof ACTIONS)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser(request);
    const { id: messageId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action as Action;
    const requestedAccountId = typeof body?.accountId === 'string' ? body.accountId : undefined;

    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const accounts = await listEmailAccounts(userId);
    const account = requestedAccountId
      ? await getEmailAccount(userId, requestedAccountId)
      : await findAccountForMessage(userId, accounts as any, messageId) as any;
    if (!account) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (account.provider === 'outlook') {
      const changed = await modifyOutlookMessage(account, messageId, action);
      const moved = changed.id && changed.id !== messageId;
      await getSupabaseAdmin().from('emails').update({
        provider_message_id: changed.id || messageId,
        is_read: changed.isRead !== false,
        is_starred: changed.flag?.flagStatus === 'flagged',
        is_inbox: action === 'unarchive' || action === 'untrash' ? true : action === 'archive' || action === 'trash' ? false : undefined,
        is_archived: action === 'archive' ? true : action === 'unarchive' ? false : undefined,
        is_trashed: action === 'trash' ? true : action === 'untrash' ? false : undefined,
        trashed_at: action === 'trash' ? new Date().toISOString() : action === 'untrash' ? null : undefined,
      }).eq('account_id', account.id).eq('provider_message_id', messageId);
      return NextResponse.json({ success: true, messageId: changed.id || messageId, moved });
    }
    const client = await getAuthorizedClient(account as any);
    let labelIds: string[];

    switch (action) {
      case 'archive':
        labelIds = await modifyMessage(client, messageId, [], ['INBOX']);
        break;
      case 'unarchive':
        labelIds = await modifyMessage(client, messageId, ['INBOX'], []);
        break;
      case 'trash':
        labelIds = await trashMessage(client, messageId);
        break;
      case 'untrash':
        labelIds = await untrashMessage(client, messageId);
        break;
      case 'markRead':
        labelIds = await modifyMessage(client, messageId, [], ['UNREAD']);
        break;
      case 'markUnread':
        labelIds = await modifyMessage(client, messageId, ['UNREAD'], []);
        break;
      case 'star':
        labelIds = await modifyMessage(client, messageId, ['STARRED'], []);
        break;
      case 'unstar':
        labelIds = await modifyMessage(client, messageId, [], ['STARRED']);
        break;
    }

    await refreshCachedMessage(userId, account.id, { id: messageId, labelIds });

    return NextResponse.json({ success: true, labelIds });
  } catch (error) {
    return handleApiError(error);
  }
}

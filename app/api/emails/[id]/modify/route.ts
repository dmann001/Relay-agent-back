// Email actions: archive / trash / read / star.
// Gmail is the source of truth - the action runs against the Gmail API first,
// then the DB metadata cache is updated from the labels Gmail returns.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, getAuthorizedClient } from '@/lib/server/gmail-accounts';
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

    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const accounts = await listGmailAccounts(userId);
    const account = await findAccountForMessage(userId, accounts, messageId);
    if (!account) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const client = await getAuthorizedClient(account);
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

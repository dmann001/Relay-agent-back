import { getSupabaseAdmin } from './supabase-admin';
import type { EmailAccountRow } from './email-accounts';
import { graphRequest, type OutlookMessage } from './outlook-api';
import { getSyncState, mergeMailboxPageTokens, parseMailboxPageTokens, updateSyncState } from './gmail-accounts';
import { upsertEmailRows, type Mailbox, type SyncResult } from './email-sync';

const FOLDERS: Record<string, string> = {
  inbox: 'inbox', sent: 'sentitems', trash: 'deleteditems', archive: 'archive', drafts: 'drafts',
};
const fields = 'id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,parentFolderId,flag,categories';
const addr = (r: any) => ({ name: r?.emailAddress?.name || r?.emailAddress?.address || '', email: r?.emailAddress?.address || '' });

const toRow = (userId: string, accountId: string, message: OutlookMessage, mailbox: string) => ({
  user_id: userId, account_id: accountId, provider: 'outlook' as const,
  provider_message_id: message.id, provider_thread_id: message.conversationId || message.id,
  rfc_message_id: message.internetMessageId?.replace(/[<>]/g, '') || null,
  subject: message.subject || '(No Subject)', from_name: addr(message.from).name, from_email: addr(message.from).email,
  snippet: message.bodyPreview || '', sent_at: message.sentDateTime || message.receivedDateTime,
  received_at: message.receivedDateTime || message.sentDateTime || new Date().toISOString(),
  is_read: message.isRead !== false, is_archived: mailbox === 'archive',
  is_starred: message.flag?.flagStatus === 'flagged', is_trashed: mailbox === 'trash',
  trashed_at: mailbox === 'trash' ? new Date().toISOString() : null,
  is_inbox: mailbox === 'inbox', is_sent: mailbox === 'sent',
  labels: message.categories || [], to_recipients: (message.toRecipients || []).map(addr),
  has_attachments: Boolean(message.hasAttachments), gmail_category: null,
});

async function syncFolder(userId: string, account: EmailAccountRow, mailbox: string, cursor?: string | null) {
  const url = cursor || `/me/mailFolders/${FOLDERS[mailbox]}/messages/delta?$select=${fields}&$top=50`;
  let count = 0;
  let deleted = 0;
  // One page per request keeps UI-triggered sync bounded; load-more continues nextLink.
  const result = await graphRequest<{ value: Array<OutlookMessage & { '@removed'?: unknown }>; '@odata.nextLink'?: string; '@odata.deltaLink'?: string }>(account, url);
  const active = result.value.filter((m) => !m['@removed']);
  await upsertEmailRows(active.map((m) => toRow(userId, account.id, m, mailbox)) as any);
  const removed = result.value.filter((m) => m['@removed']).map((m) => m.id);
  if (removed.length) {
    await getSupabaseAdmin().from('emails').delete().eq('account_id', account.id).in('provider_message_id', removed);
  }
  count += active.length; deleted += removed.length;
  const next = result['@odata.nextLink'] || result['@odata.deltaLink'];
  return { count, deleted, cursor: next, hasMore: Boolean(result['@odata.nextLink']) };
}

export async function syncOutlookAccount(
  userId: string, account: EmailAccountRow,
  options: { mailbox?: Mailbox; force?: boolean; loadMore?: boolean } = {},
): Promise<SyncResult> {
  const state = await getSyncState(account.id);
  const tokens = parseMailboxPageTokens(state?.pagination_token);
  const requested = options.mailbox || 'inbox';
  const mailboxes = options.mailbox ? [requested] : ['inbox', 'sent'];
  let synced = 0; let deleted = 0; let hasMore = false;
  const updates: Record<string, string | null> = {};
  for (const mailbox of mailboxes) {
    const cursor = (tokens as any)[mailbox];
    const result = await syncFolder(userId, account, mailbox, cursor);
    synced += result.count; deleted += result.deleted; hasMore ||= result.hasMore;
    updates[mailbox] = result.cursor || null;
  }
  await updateSyncState(account.id, {
    pagination_token: mergeMailboxPageTokens(state?.pagination_token, updates),
    initial_sync_done: true, last_successful_sync_at: new Date().toISOString(), last_error: null,
    ...(requested === 'trash' ? { trash_synced_at: new Date().toISOString() } : {}),
  });
  return { accountId: account.id, email: account.email, synced, deleted, mode: state?.initial_sync_done ? (options.loadMore ? 'loadMore' : 'incremental') : 'initial', hasMore };
}

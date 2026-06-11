// Sync orchestration: Gmail -> Relay DB metadata cache.
//
// The DB is a display cache only. It stores message metadata (sender, subject,
// snippet, labels, flags) - never full bodies. Full bodies are fetched live
// from Gmail when the user opens an email.
import type { OAuth2Client } from 'google-auth-library';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import {
  GmailAccountRow,
  getAuthorizedClient,
  getSyncState,
  mergeMailboxPageTokens,
  parseMailboxPageTokens,
  updateSyncState,
} from '@/lib/server/gmail-accounts';
import {
  GmailMessageMetadata,
  fetchMessageMetadataBatch,
  getProfileHistoryId,
  listDrafts,
  listHistoryDelta,
  listMessageIdsPage,
  parseMessageMetadata,
} from '@/lib/server/gmail-api';
import type { Email } from '@/types';

const INITIAL_FETCH_COUNT = 50;
// Skip background inbox syncs if we synced recently (saves Gmail quota).
const MIN_BACKGROUND_SYNC_MS = 3 * 60 * 1000;

export type Mailbox = 'inbox' | 'sent' | 'archive' | 'trash' | 'drafts';

const INBOX_QUERY = 'in:inbox -in:spam';
const SENT_QUERY = 'in:sent -in:trash';
const TRASH_QUERY = 'in:trash';

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const metadataToRow = (userId: string, accountId: string, meta: GmailMessageMetadata) => ({
  user_id: userId,
  account_id: accountId,
  provider: 'gmail' as const,
  provider_message_id: meta.gmailMessageId,
  provider_thread_id: meta.gmailThreadId,
  rfc_message_id: meta.rfcMessageId ?? null,
  subject: meta.subject,
  from_name: meta.from.name,
  from_email: meta.from.email,
  snippet: meta.snippet,
  sent_at: meta.date,
  received_at: meta.date,
  is_read: !meta.isUnread,
  is_archived: !meta.isInbox && !meta.isTrashed && !meta.isSent && !meta.isDraft,
  is_starred: meta.isStarred,
  is_trashed: meta.isTrashed,
  trashed_at: meta.isTrashed ? new Date().toISOString() : null,
  is_inbox: meta.isInbox,
  is_sent: meta.isSent,
  labels: meta.labels,
  to_recipients: meta.to,
  has_attachments: meta.hasAttachment,
  gmail_category: meta.gmailCategory ?? null,
  // Intentionally no body_html / body_plain: metadata cache only.
});

export interface EmailRow {
  provider_message_id: string;
  provider_thread_id: string | null;
  rfc_message_id: string | null;
  subject: string;
  from_name: string | null;
  from_email: string | null;
  snippet: string | null;
  received_at: string | null;
  is_read: boolean;
  is_archived: boolean;
  is_starred: boolean;
  is_trashed: boolean;
  is_inbox: boolean;
  is_sent: boolean;
  labels: string[] | null;
  to_recipients: Array<{ name: string; email: string }> | null;
  has_attachments: boolean;
  gmail_category: Email['gmailCategory'] | null;
}

export const EMAIL_ROW_COLUMNS =
  'provider_message_id, provider_thread_id, rfc_message_id, subject, from_name, from_email, snippet, received_at, is_read, is_archived, is_starred, is_trashed, is_inbox, is_sent, labels, to_recipients, has_attachments, gmail_category';

// DB row -> frontend Email shape (metadata only; body fields stay empty).
export function rowToEmail(row: EmailRow): Email {
  const fromName = row.from_name || row.from_email || 'Unknown';
  return {
    id: row.provider_message_id,
    threadId: row.provider_thread_id || '',
    from: {
      name: fromName,
      email: row.from_email || '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fromName)}&background=random`,
    },
    to: Array.isArray(row.to_recipients) ? row.to_recipients : [],
    subject: row.subject || '(No Subject)',
    body: '',
    bodyPlain: row.snippet || '',
    snippet: row.snippet || '',
    date: row.received_at || new Date().toISOString(),
    read: row.is_read,
    labels: (row.labels || []).filter(
      (l) => !['UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_PRIMARY', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(l)
    ),
    provider: 'gmail',
    messageId: row.rfc_message_id || undefined,
    gmailCategory: row.gmail_category || undefined,
    hasAttachments: row.has_attachments,
    isArchived: row.is_archived,
    isTrashed: row.is_trashed,
    isStarred: row.is_starred,
  };
}

// ---------------------------------------------------------------------------
// Upserts
// ---------------------------------------------------------------------------

type EmailUpsertRow = ReturnType<typeof metadataToRow>;

// Postgres 42P10 means the DB is missing unique(account_id, provider_message_id).
// Fall back to per-row insert/update so sync still works before the migration runs.
async function upsertEmailRows(rows: EmailUpsertRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('emails')
    .upsert(rows, { onConflict: 'account_id,provider_message_id' });

  if (!error) return;

  if (error.code === '42P10') {
    for (const row of rows) {
      const { data: existing } = await supabase
        .from('emails')
        .select('id')
        .eq('account_id', row.account_id)
        .eq('provider_message_id', row.provider_message_id)
        .maybeSingle();

      const { error: writeError } = existing
        ? await supabase.from('emails').update(row).eq('id', existing.id)
        : await supabase.from('emails').insert(row);
      if (writeError) throw writeError;
    }
    return;
  }

  throw error;
}

async function upsertMetadata(
  userId: string,
  accountId: string,
  metas: GmailMessageMetadata[]
): Promise<number> {
  if (metas.length === 0) return 0;
  const rows = metas.map((meta) => metadataToRow(userId, accountId, meta));
  await upsertEmailRows(rows);
  return rows.length;
}

async function deleteMessages(accountId: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const { error } = await getSupabaseAdmin()
    .from('emails')
    .delete()
    .eq('account_id', accountId)
    .in('provider_message_id', messageIds);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Mailbox list sync (initial sync + fallback when history is unavailable)
// ---------------------------------------------------------------------------

interface MailboxListSyncResult {
  count: number;
  nextPageToken?: string;
}

async function syncMailboxByList(
  userId: string,
  account: GmailAccountRow,
  client: OAuth2Client,
  mailbox: 'inbox' | 'sent' | 'trash',
  options: { pageToken?: string } = {}
): Promise<MailboxListSyncResult> {
  const query = mailbox === 'inbox' ? INBOX_QUERY : mailbox === 'sent' ? SENT_QUERY : TRASH_QUERY;
  const { ids, nextPageToken } = await listMessageIdsPage(
    client,
    query,
    INITIAL_FETCH_COUNT,
    options.pageToken
  );
  if (ids.length === 0) return { count: 0, nextPageToken };

  const metas = await fetchMessageMetadataBatch(client, ids);
  const count = await upsertMetadata(userId, account.id, metas);

  // Reconcile only the first page — not when paginating deeper into history.
  if (!options.pageToken) {
    const flagColumn = mailbox === 'inbox' ? 'is_inbox' : mailbox === 'sent' ? 'is_sent' : 'is_trashed';
    const oldestListedDate = metas.reduce(
      (oldest, meta) => (meta.date < oldest ? meta.date : oldest),
      new Date().toISOString()
    );

    const { data: staleRows } = await getSupabaseAdmin()
      .from('emails')
      .select('provider_message_id')
      .eq('account_id', account.id)
      .eq(flagColumn, true)
      .gte('received_at', oldestListedDate)
      .not('provider_message_id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`);

    const staleIds = (staleRows || []).map((r) => r.provider_message_id);
    if (staleIds.length > 0) {
      const staleMetas = await fetchMessageMetadataBatch(client, staleIds);
      await upsertMetadata(userId, account.id, staleMetas);
      const foundIds = new Set(staleMetas.map((m) => m.gmailMessageId));
      await deleteMessages(account.id, staleIds.filter((id) => !foundIds.has(id)));
    }
  }

  return { count, nextPageToken };
}

/** Fetches the next page of inbox/sent messages from Gmail into the DB cache. */
export async function loadMoreMailbox(
  userId: string,
  account: GmailAccountRow,
  client: OAuth2Client,
  mailbox: 'inbox' | 'sent'
): Promise<{ synced: number; hasMore: boolean }> {
  const state = await getSyncState(account.id);
  const tokens = parseMailboxPageTokens(state?.pagination_token);
  const tokenKey = mailbox === 'inbox' ? 'inbox' : 'sent';
  const pageToken = mailbox === 'inbox' ? tokens.inbox : tokens.sent;
  const query = mailbox === 'inbox' ? INBOX_QUERY : SENT_QUERY;

  // Accounts synced before pagination tokens were stored: walk Gmail pages
  // until we find messages not yet in the DB cache.
  if (!pageToken) {
    let walkToken: string | undefined;
    for (let step = 0; step < 40; step++) {
      const page = await listMessageIdsPage(client, query, INITIAL_FETCH_COUNT, walkToken);
      if (page.ids.length === 0) return { synced: 0, hasMore: false };

      const { data: cached } = await getSupabaseAdmin()
        .from('emails')
        .select('provider_message_id')
        .eq('account_id', account.id)
        .in('provider_message_id', page.ids);
      const cachedSet = new Set((cached || []).map((r) => r.provider_message_id));
      const newIds = page.ids.filter((id) => !cachedSet.has(id));

      if (newIds.length > 0) {
        const metas = await fetchMessageMetadataBatch(client, newIds);
        const synced = await upsertMetadata(userId, account.id, metas);
        await updateSyncState(account.id, {
          pagination_token: mergeMailboxPageTokens(state?.pagination_token, {
            [tokenKey]: page.nextPageToken ?? null,
          }),
          last_successful_sync_at: new Date().toISOString(),
          last_error: null,
        });
        return { synced, hasMore: !!page.nextPageToken };
      }

      if (!page.nextPageToken) return { synced: 0, hasMore: false };
      walkToken = page.nextPageToken;
    }
    return { synced: 0, hasMore: false };
  }

  const result = await syncMailboxByList(userId, account, client, mailbox, { pageToken });

  await updateSyncState(account.id, {
    pagination_token: mergeMailboxPageTokens(state?.pagination_token, {
      [tokenKey]: result.nextPageToken ?? null,
    }),
    last_successful_sync_at: new Date().toISOString(),
    last_error: null,
  });

  return { synced: result.count, hasMore: !!result.nextPageToken };
}

/** True when at least one connected account has more inbox pages in Gmail. */
export async function inboxHasMorePages(userId: string): Promise<boolean> {
  const { data: accounts } = await getSupabaseAdmin()
    .from('email_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'gmail')
    .is('revoked_at', null);

  if (!accounts?.length) return false;

  for (const account of accounts) {
    const state = await getSyncState(account.id);
    const tokens = parseMailboxPageTokens(state?.pagination_token);
    if (tokens.inbox) return true;
  }

  // No stored token yet (legacy sync): a full cached page likely means more in Gmail.
  const { count } = await getSupabaseAdmin()
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_inbox', true)
    .eq('is_trashed', false);

  return (count ?? 0) >= INITIAL_FETCH_COUNT;
}

// ---------------------------------------------------------------------------
// Drafts sync
// ---------------------------------------------------------------------------

export async function syncDrafts(
  userId: string,
  account: GmailAccountRow,
  client: OAuth2Client
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const drafts = await listDrafts(client);
  const metasById = new Map<string, GmailMessageMetadata>();

  if (drafts.length > 0) {
    const metas = await fetchMessageMetadataBatch(client, drafts.map((d) => d.messageId));
    for (const meta of metas) metasById.set(meta.gmailMessageId, meta);
  }

  const rows = drafts
    .map((draft) => {
      const meta = metasById.get(draft.messageId);
      if (!meta) return null;
      return {
        user_id: userId,
        account_id: account.id,
        provider: 'gmail' as const,
        gmail_draft_id: draft.draftId,
        to_emails: meta.to.map((t) => t.email),
        cc_emails: [] as string[],
        subject: meta.subject === '(No Subject)' ? '' : meta.subject,
        snippet: meta.snippet,
        body: '',
        status: 'saved' as const,
        last_edited_at: meta.date,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  // Replace this account's Gmail-backed drafts with the current Gmail state.
  const keepIds = drafts.map((d) => d.draftId);
  let deleteQuery = supabase
    .from('drafts')
    .delete()
    .eq('account_id', account.id)
    .not('gmail_draft_id', 'is', null);
  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not('gmail_draft_id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  if (rows.length > 0) {
    const { error } = await supabase
      .from('drafts')
      .upsert(rows, { onConflict: 'account_id,gmail_draft_id' });

    if (error?.code === '42P10') {
      for (const row of rows) {
        const accountId = row.account_id as string;
        const gmailDraftId = row.gmail_draft_id as string;
        const { data: existing } = await supabase
          .from('drafts')
          .select('id')
          .eq('account_id', accountId)
          .eq('gmail_draft_id', gmailDraftId)
          .maybeSingle();

        const { error: writeError } = existing
          ? await supabase.from('drafts').update(row).eq('id', existing.id)
          : await supabase.from('drafts').insert(row);
        if (writeError) throw writeError;
      }
    } else if (error) {
      throw error;
    }
  }

  return rows.length;
}

// ---------------------------------------------------------------------------
// Account sync entry point
// ---------------------------------------------------------------------------

export interface SyncResult {
  accountId: string;
  email: string;
  synced: number;
  deleted: number;
  mode: 'initial' | 'incremental' | 'list' | 'skipped' | 'loadMore';
  hasMore?: boolean;
  error?: string;
}

export async function syncAccount(
  userId: string,
  account: GmailAccountRow,
  options: { mailbox?: Mailbox; force?: boolean; loadMore?: boolean } = {}
): Promise<SyncResult> {
  const state = await getSyncState(account.id);
  let synced = 0;
  let deleted = 0;
  let mode: SyncResult['mode'] = 'incremental';

  // Load the next Gmail page into the DB cache (triggered by inbox pagination).
  if (options.loadMore && (options.mailbox === 'inbox' || options.mailbox === 'sent')) {
    const client = await getAuthorizedClient(account);
    const result = await loadMoreMailbox(userId, account, client, options.mailbox);
    return {
      accountId: account.id,
      email: account.email,
      synced: result.synced,
      deleted: 0,
      mode: 'loadMore',
      hasMore: result.hasMore,
    };
  }

  // Trash is only synced on demand (when the user opens Trash).
  if (options.mailbox === 'trash') {
    const client = await getAuthorizedClient(account);
    const { count } = await syncMailboxByList(userId, account, client, 'trash');
    synced = count;
    await updateSyncState(account.id, {
      trash_synced_at: new Date().toISOString(),
      last_error: null,
    });
    return { accountId: account.id, email: account.email, synced, deleted, mode: 'list' };
  }

  if (options.mailbox === 'drafts') {
    const client = await getAuthorizedClient(account);
    synced = await syncDrafts(userId, account, client);
    await updateSyncState(account.id, { last_error: null });
    return { accountId: account.id, email: account.email, synced, deleted, mode: 'list' };
  }

  // Background inbox sync: use History API only; skip if we synced recently.
  if (
    !options.force &&
    !options.mailbox &&
    state?.initial_sync_done &&
    state.last_successful_sync_at
  ) {
    const elapsed = Date.now() - new Date(state.last_successful_sync_at).getTime();
    if (elapsed < MIN_BACKGROUND_SYNC_MS) {
      return {
        accountId: account.id,
        email: account.email,
        synced: 0,
        deleted: 0,
        mode: 'skipped',
      };
    }
  }

  const client = await getAuthorizedClient(account);

  if (!state?.initial_sync_done) {
    // Initial sync: latest 50 inbox + 50 sent + drafts; establish history baseline.
    mode = 'initial';
    const historyId = await getProfileHistoryId(client);
    const inboxResult = await syncMailboxByList(userId, account, client, 'inbox');
    const sentResult = await syncMailboxByList(userId, account, client, 'sent');
    synced += inboxResult.count + sentResult.count;
    // Drafts are non-critical: a failure here must not wedge the whole
    // initial sync (otherwise it re-runs forever and the inbox never settles).
    try {
      await syncDrafts(userId, account, client);
    } catch (error) {
      console.error(`[Sync] Drafts sync failed for ${account.email} (non-fatal):`, error);
    }
    await updateSyncState(account.id, {
      history_id: historyId ?? null,
      pagination_token: mergeMailboxPageTokens(state?.pagination_token, {
        inbox: inboxResult.nextPageToken ?? null,
        sent: sentResult.nextPageToken ?? null,
      }),
      initial_sync_done: true,
      last_successful_sync_at: new Date().toISOString(),
      last_error: null,
    });
  } else if (state.history_id) {
    // Incremental sync via the Gmail History API.
    const delta = await listHistoryDelta(client, state.history_id);

    if (delta.historyExpired) {
      mode = 'list';
      const historyId = await getProfileHistoryId(client);
      const inboxResult = await syncMailboxByList(userId, account, client, 'inbox');
      const sentResult = await syncMailboxByList(userId, account, client, 'sent');
      synced += inboxResult.count + sentResult.count;
      await updateSyncState(account.id, {
        history_id: historyId ?? null,
        pagination_token: mergeMailboxPageTokens(state?.pagination_token, {
          inbox: inboxResult.nextPageToken ?? null,
          sent: sentResult.nextPageToken ?? null,
        }),
        last_successful_sync_at: new Date().toISOString(),
        last_error: null,
      });
    } else {
      if (delta.changedMessageIds.length > 0) {
        const metas = await fetchMessageMetadataBatch(client, delta.changedMessageIds);
        // Cache inbox/sent/trash messages and anything we already track;
        // ignore other mail (e.g. spam) so the cache stays focused.
        const { data: knownRows } = await getSupabaseAdmin()
          .from('emails')
          .select('provider_message_id')
          .eq('account_id', account.id)
          .in('provider_message_id', metas.map((m) => m.gmailMessageId));
        const known = new Set((knownRows || []).map((r) => r.provider_message_id));
        const relevant = metas.filter(
          (m) => !m.isDraft && (m.isInbox || m.isSent || m.isTrashed || known.has(m.gmailMessageId))
        );
        synced = await upsertMetadata(userId, account.id, relevant);
      }
      if (delta.deletedMessageIds.length > 0) {
        await deleteMessages(account.id, delta.deletedMessageIds);
        deleted = delta.deletedMessageIds.length;
      }
      await updateSyncState(account.id, {
        history_id: delta.newHistoryId ?? state.history_id,
        last_successful_sync_at: new Date().toISOString(),
        last_error: null,
      });
    }
  } else {
    // No history baseline: list sync and establish one.
    mode = 'list';
    const historyId = await getProfileHistoryId(client);
    const inboxResult = await syncMailboxByList(userId, account, client, 'inbox');
    const sentResult = await syncMailboxByList(userId, account, client, 'sent');
    synced += inboxResult.count + sentResult.count;
    await updateSyncState(account.id, {
      history_id: historyId ?? null,
      pagination_token: mergeMailboxPageTokens(state?.pagination_token, {
        inbox: inboxResult.nextPageToken ?? null,
        sent: sentResult.nextPageToken ?? null,
      }),
      last_successful_sync_at: new Date().toISOString(),
      last_error: null,
    });
  }

  await getSupabaseAdmin()
    .from('email_accounts')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', account.id);

  return { accountId: account.id, email: account.email, synced, deleted, mode };
}

// Refreshes a single cached row from a Gmail metadata payload (used after
// modify/trash actions and after opening an email).
export async function refreshCachedMessage(
  userId: string,
  accountId: string,
  message: { id: string; labelIds: string[] }
): Promise<void> {
  const labels = message.labelIds || [];
  const { error } = await getSupabaseAdmin()
    .from('emails')
    .update({
      is_read: !labels.includes('UNREAD'),
      is_starred: labels.includes('STARRED'),
      is_inbox: labels.includes('INBOX'),
      is_sent: labels.includes('SENT'),
      is_trashed: labels.includes('TRASH'),
      trashed_at: labels.includes('TRASH') ? new Date().toISOString() : null,
      is_archived:
        !labels.includes('INBOX') &&
        !labels.includes('TRASH') &&
        !labels.includes('SENT') &&
        !labels.includes('DRAFT'),
      labels,
    })
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('provider_message_id', message.id);
  if (error) throw error;
}

// Resolves which connected account owns a Gmail message id (via the cache,
// falling back to the first account when the message is not cached yet).
export async function findAccountForMessage(
  userId: string,
  accounts: GmailAccountRow[],
  messageId: string
): Promise<GmailAccountRow | null> {
  const { data } = await getSupabaseAdmin()
    .from('emails')
    .select('account_id')
    .eq('user_id', userId)
    .eq('provider_message_id', messageId)
    .maybeSingle();

  if (data?.account_id) {
    return accounts.find((a) => a.id === data.account_id) ?? null;
  }
  return accounts[0] ?? null;
}

export { parseMessageMetadata, upsertEmailRows };

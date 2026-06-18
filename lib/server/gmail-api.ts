// Gmail API operations used by the metadata-cache sync architecture.
// All functions take an authorized OAuth2 client (see gmail-accounts.ts).
import { google, gmail_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { gmail as gmailLegacy } from '@/lib/gmail';
import type { Email } from '@/types';

export interface GmailMessageMetadata {
  gmailMessageId: string;
  gmailThreadId: string;
  rfcMessageId?: string;
  from: { name: string; email: string };
  to: Array<{ name: string; email: string }>;
  subject: string;
  snippet: string;
  date: string; // ISO
  labels: string[];
  isUnread: boolean;
  isStarred: boolean;
  isInbox: boolean;
  isSent: boolean;
  isTrashed: boolean;
  isDraft: boolean;
  hasAttachment: boolean;
  gmailCategory?: 'primary' | 'promotions' | 'social' | 'updates' | 'forums';
}

const getApi = (client: OAuth2Client) => google.gmail({ version: 'v1', auth: client });

const parseEmailAddress = (value: string): { name: string; email: string } => {
  const match = value.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim().replace(/"/g, ''), email: match[2].trim() };
  }
  return { name: value.trim(), email: value.trim() };
};

const decodeSnippet = (snippet: string): string =>
  snippet
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

// Metadata responses include part structure (without body data), so we can
// detect attachments without an extra `has:attachment` list query.
const partHasAttachment = (part: gmail_v1.Schema$MessagePart | undefined): boolean => {
  if (!part) return false;
  if (part.filename && part.body?.attachmentId) return true;
  for (const child of part.parts || []) {
    if (partHasAttachment(child)) return true;
  }
  return false;
};

export function parseMessageMetadata(message: gmail_v1.Schema$Message): GmailMessageMetadata | null {
  try {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const labels = message.labelIds || [];
    const fromHeader = getHeader('from');
    const toHeader = getHeader('to');

    let gmailCategory: GmailMessageMetadata['gmailCategory'];
    if (labels.includes('CATEGORY_PERSONAL') || labels.includes('CATEGORY_PRIMARY')) gmailCategory = 'primary';
    else if (labels.includes('CATEGORY_PROMOTIONS')) gmailCategory = 'promotions';
    else if (labels.includes('CATEGORY_SOCIAL')) gmailCategory = 'social';
    else if (labels.includes('CATEGORY_UPDATES')) gmailCategory = 'updates';
    else if (labels.includes('CATEGORY_FORUMS')) gmailCategory = 'forums';

    return {
      gmailMessageId: message.id || '',
      gmailThreadId: message.threadId || '',
      rfcMessageId: getHeader('message-id').replace(/[<>]/g, '') || undefined,
      from: parseEmailAddress(fromHeader),
      to: toHeader
        ? toHeader.split(',').map((value) => parseEmailAddress(value.trim()))
        : [],
      subject: getHeader('subject') || '(No Subject)',
      snippet: decodeSnippet(message.snippet || ''),
      date: message.internalDate
        ? new Date(parseInt(message.internalDate, 10)).toISOString()
        : new Date().toISOString(),
      labels,
      isUnread: labels.includes('UNREAD'),
      isStarred: labels.includes('STARRED'),
      isInbox: labels.includes('INBOX'),
      isSent: labels.includes('SENT'),
      isTrashed: labels.includes('TRASH'),
      isDraft: labels.includes('DRAFT'),
      hasAttachment: partHasAttachment(message.payload),
      gmailCategory,
    };
  } catch (error) {
    console.error('[GmailApi] Failed to parse message metadata:', error);
    return null;
  }
}

export interface MessageIdPage {
  ids: string[];
  nextPageToken?: string;
}

export async function listMessageIdsPage(
  client: OAuth2Client,
  query: string,
  maxResults: number,
  pageToken?: string
): Promise<MessageIdPage> {
  const response = await getApi(client).users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
    pageToken,
  });
  return {
    ids: (response.data.messages || []).map((m) => m.id!).filter(Boolean),
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

export async function listMessageIds(
  client: OAuth2Client,
  query: string,
  maxResults: number
): Promise<string[]> {
  const page = await listMessageIdsPage(client, query, maxResults);
  return page.ids;
}

export async function fetchMessageMetadataBatch(
  client: OAuth2Client,
  messageIds: string[]
): Promise<GmailMessageMetadata[]> {
  const api = getApi(client);
  const results: GmailMessageMetadata[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        const { data } = await api.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date', 'Message-ID'],
        });
        return parseMessageMetadata(data);
      })
    );
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) results.push(result.value);
      else if (result.status === 'rejected') console.error('[GmailApi] metadata fetch failed:', result.reason);
    }
  }

  return results;
}

// Full body fetch for a single message (used when the user opens an email).
export async function fetchFullMessage(
  client: OAuth2Client,
  messageId: string
): Promise<{ email: Email; labelIds: string[] } | null> {
  const { data } = await getApi(client).users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const email = gmailLegacy.parseGmailMessage(data);
  if (!email) return null;
  return { email, labelIds: data.labelIds || [] };
}

export async function fetchFullThread(
  client: OAuth2Client,
  threadId: string
): Promise<Email[]> {
  const { data } = await getApi(client).users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  return (data.messages || [])
    .map((message) => gmailLegacy.parseGmailMessage(message))
    .filter((email): email is Email => Boolean(email))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function modifyMessage(
  client: OAuth2Client,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<string[]> {
  const { data } = await getApi(client).users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  });
  return data.labelIds || [];
}

export async function trashMessage(client: OAuth2Client, messageId: string): Promise<string[]> {
  const { data } = await getApi(client).users.messages.trash({ userId: 'me', id: messageId });
  return data.labelIds || [];
}

export async function untrashMessage(client: OAuth2Client, messageId: string): Promise<string[]> {
  const { data } = await getApi(client).users.messages.untrash({ userId: 'me', id: messageId });
  return data.labelIds || [];
}

export async function getProfileHistoryId(client: OAuth2Client): Promise<string | undefined> {
  const { data } = await getApi(client).users.getProfile({ userId: 'me' });
  return data.historyId || undefined;
}

export interface HistoryDelta {
  newHistoryId?: string;
  changedMessageIds: string[];
  deletedMessageIds: string[];
  historyExpired: boolean;
}

// Collects message ids that were added, deleted, or had label changes
// (read/unread, archive, trash, star) since `startHistoryId`.
export async function listHistoryDelta(
  client: OAuth2Client,
  startHistoryId: string
): Promise<HistoryDelta> {
  const api = getApi(client);
  const changed = new Set<string>();
  const deleted = new Set<string>();
  let newHistoryId: string | undefined;
  let pageToken: string | undefined;

  try {
    do {
      const { data } = await api.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
        pageToken,
      });
      newHistoryId = data.historyId || newHistoryId;

      for (const record of data.history || []) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) changed.add(added.message.id);
        }
        for (const removed of record.messagesDeleted || []) {
          if (removed.message?.id) {
            deleted.add(removed.message.id);
            changed.delete(removed.message.id);
          }
        }
        for (const labelAdded of record.labelsAdded || []) {
          if (labelAdded.message?.id) changed.add(labelAdded.message.id);
        }
        for (const labelRemoved of record.labelsRemoved || []) {
          if (labelRemoved.message?.id) changed.add(labelRemoved.message.id);
        }
      }

      pageToken = data.nextPageToken || undefined;
    } while (pageToken);
  } catch (error: any) {
    if (error?.code === 404 || error?.code === 410 || error?.response?.status === 404) {
      // History too old; the caller should fall back to a list-based sync.
      return { newHistoryId: undefined, changedMessageIds: [], deletedMessageIds: [], historyExpired: true };
    }
    throw error;
  }

  return {
    newHistoryId,
    changedMessageIds: Array.from(changed),
    deletedMessageIds: Array.from(deleted),
    historyExpired: false,
  };
}

export async function getAttachment(
  client: OAuth2Client,
  messageId: string,
  attachmentId: string
): Promise<string> {
  const { data } = await getApi(client).users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  return data.data || '';
}

// ---------------------------------------------------------------------------
// Sending & drafts
// ---------------------------------------------------------------------------

export type OutgoingAttachment = {
  filename: string;
  mimeType: string;
  data: string;
};

const sanitizeHeaderValue = (value: string): string =>
  value.replace(/[\r\n"]/g, (character) => character === '"' ? "'" : '');

const foldBase64 = (value: string): string =>
  value.replace(/\s+/g, '').match(/.{1,76}/g)?.join('\r\n') || '';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const formatOutgoingBodyAsHtml = (content: string) => {
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  if (hasHtml) return content;
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split('\n').map((line) => escapeHtml(line));
      return `<p>${lines.join('<br />')}</p>`;
    })
    .join('');
};

export const buildRawMessage = (params: {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  inReplyToMessageId?: string;
  attachments?: OutgoingAttachment[];
}): string => {
  const headers = [`To: ${params.to.join(', ')}`];
  if (params.cc && params.cc.length > 0) headers.push(`Cc: ${params.cc.join(', ')}`);
  if (params.inReplyToMessageId) {
    headers.push(`In-Reply-To: <${params.inReplyToMessageId}>`);
    headers.push(`References: <${params.inReplyToMessageId}>`);
  }
  headers.push(`Subject: ${params.subject}`);

  const htmlBody = formatOutgoingBodyAsHtml(params.body);
  let message = '';

  if (params.attachments && params.attachments.length > 0) {
    const boundary = `==RELAYSPLIT_${Date.now()}==`;
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message = [
      ...headers,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      ...params.attachments.flatMap((attachment) => {
        const filename = sanitizeHeaderValue(attachment.filename);
        const mimeType = sanitizeHeaderValue(attachment.mimeType) || 'application/octet-stream';
        return [
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${filename}"`,
        '',
        foldBase64(attachment.data),
        '',
        ];
      }),
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    headers.push('Content-Type: text/html; charset=utf-8');
    message = [...headers, '', htmlBody].join('\r\n');
  }

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export async function sendMessage(
  client: OAuth2Client,
  params: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    threadId?: string;
    inReplyToMessageId?: string;
    attachments?: OutgoingAttachment[];
  }
): Promise<{ id?: string | null; threadId?: string | null }> {
  const raw = buildRawMessage(params);
  const { data } = await getApi(client).users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: params.threadId },
  });
  return { id: data.id, threadId: data.threadId };
}

export async function createDraft(
  client: OAuth2Client,
  params: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    threadId?: string;
    inReplyToMessageId?: string;
    attachments?: OutgoingAttachment[];
  }
): Promise<{ draftId: string; messageId?: string | null }> {
  const raw = buildRawMessage(params);
  const { data } = await getApi(client).users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw, threadId: params.threadId } },
  });
  return { draftId: data.id!, messageId: data.message?.id };
}

export async function updateDraft(
  client: OAuth2Client,
  draftId: string,
  params: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    threadId?: string;
    inReplyToMessageId?: string;
    attachments?: OutgoingAttachment[];
  }
): Promise<{ draftId: string; messageId?: string | null }> {
  const raw = buildRawMessage(params);
  const { data } = await getApi(client).users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: { message: { raw, threadId: params.threadId } },
  });
  return { draftId: data.id!, messageId: data.message?.id };
}

export async function deleteDraft(client: OAuth2Client, draftId: string): Promise<void> {
  await getApi(client).users.drafts.delete({ userId: 'me', id: draftId });
}

export async function listDrafts(
  client: OAuth2Client,
  maxResults: number = 50
): Promise<Array<{ draftId: string; messageId: string }>> {
  const { data } = await getApi(client).users.drafts.list({ userId: 'me', maxResults });
  return (data.drafts || [])
    .filter((d) => d.id && d.message?.id)
    .map((d) => ({ draftId: d.id!, messageId: d.message!.id! }));
}

export async function sendDraft(
  client: OAuth2Client,
  draftId: string
): Promise<{ id?: string | null; threadId?: string | null }> {
  const { data } = await getApi(client).users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId },
  });
  return { id: data.id, threadId: data.threadId };
}

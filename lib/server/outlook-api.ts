import type { Email, EmailAttachment } from '@/types';
import type { EmailAccountRow } from './email-accounts';
import { getOutlookAccessToken } from './outlook-accounts';
import { formatOutgoingBodyAsHtml } from './gmail-api';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const headers = (token: string) => ({
  Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
  Prefer: 'IdType="ImmutableId", outlook.body-content-type="html"',
});

export async function graphRequest<T>(account: EmailAccountRow, path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${GRAPH}${path}`;
  const request = (token: string) => fetch(url, {
    ...init, headers: { ...headers(token), ...(init.headers || {}) },
  });
  let response = await request(await getOutlookAccessToken(account));
  if (response.status === 401 && account.refresh_token) {
    response = await request(await getOutlookAccessToken(account, true));
  }
  if (response.status === 429) {
    const delay = Math.min(Number(response.headers.get('retry-after') || 1), 5);
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    response = await request(await getOutlookAccessToken(account));
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const graphMessage = payload?.error?.message || `Microsoft Graph request failed (${response.status})`;
    const guestHint = response.status === 401 && account.email.toUpperCase().includes('#EXT#')
      ? ' This is an Entra guest identity without an Outlook mailbox. Set MICROSOFT_TENANT_ID=common, disconnect this account, and reconnect the original Outlook account.'
      : '';
    const error = new Error(`${graphMessage}${guestHint}`) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

type Recipient = { emailAddress?: { name?: string; address?: string } };
export interface OutlookMessage {
  id: string; conversationId?: string; internetMessageId?: string; subject?: string; bodyPreview?: string;
  body?: { contentType?: string; content?: string }; from?: Recipient; toRecipients?: Recipient[]; ccRecipients?: Recipient[];
  receivedDateTime?: string; sentDateTime?: string; isRead?: boolean; isDraft?: boolean; hasAttachments?: boolean;
  parentFolderId?: string; flag?: { flagStatus?: string }; categories?: string[];
}
const addr = (r?: Recipient) => ({ name: r?.emailAddress?.name || r?.emailAddress?.address || '', email: r?.emailAddress?.address || '' });

export function outlookMessageToEmail(message: OutlookMessage, accountId?: string): Email {
  const html = message.body?.contentType?.toLowerCase() === 'html' ? message.body.content || '' : '';
  const plain = html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : message.body?.content || message.bodyPreview || '';
  return {
    id: message.id, threadId: message.conversationId || message.id, messageId: message.internetMessageId?.replace(/[<>]/g, ''),
    from: { ...addr(message.from), avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(addr(message.from).name)}&background=random` },
    to: (message.toRecipients || []).map(addr), cc: (message.ccRecipients || []).map(addr),
    subject: message.subject || '(No Subject)', body: html || plain, bodyPlain: plain,
    snippet: message.bodyPreview || plain.slice(0, 160), date: message.receivedDateTime || message.sentDateTime || new Date().toISOString(),
    read: message.isRead !== false, labels: message.categories || [], provider: 'outlook', accountId,
    hasAttachments: Boolean(message.hasAttachments), isStarred: message.flag?.flagStatus === 'flagged',
  };
}

const messageFields = 'id,conversationId,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,parentFolderId,flag,categories';
export const getOutlookMessage = (account: EmailAccountRow, id: string) =>
  graphRequest<OutlookMessage>(account, `/me/messages/${encodeURIComponent(id)}?$select=${messageFields}`);

export async function getOutlookThread(account: EmailAccountRow, message: OutlookMessage): Promise<Email[]> {
  if (!message.conversationId) return [outlookMessageToEmail(message, account.id)];
  const filter = encodeURIComponent(`conversationId eq '${message.conversationId.replace(/'/g, "''")}'`);
  const data = await graphRequest<{ value: OutlookMessage[] }>(account, `/me/messages?$filter=${filter}&$select=${messageFields}&$top=100`);
  return data.value.map((item) => outlookMessageToEmail(item, account.id))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function modifyOutlookMessage(account: EmailAccountRow, id: string, action: string): Promise<OutlookMessage> {
  if (action === 'markRead' || action === 'markUnread')
    return graphRequest(account, `/me/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ isRead: action === 'markRead' }) });
  if (action === 'star' || action === 'unstar')
    return graphRequest(account, `/me/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ flag: { flagStatus: action === 'star' ? 'flagged' : 'notFlagged' } }) });
  const destinationId = action === 'archive' ? 'archive' : action === 'trash' ? 'deleteditems' : 'inbox';
  return graphRequest(account, `/me/messages/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify({ destinationId }) });
}

const recipients = (values: string[] = []) => values.map((address) => ({ emailAddress: { address } }));
const graphMessage = (input: any) => ({
  subject: input.subject || '', body: { contentType: 'HTML', content: formatOutgoingBodyAsHtml(input.body || ' ') },
  toRecipients: recipients(input.to), ccRecipients: recipients(input.cc),
  ...(input.attachments?.length ? { attachments: input.attachments.map((a: any) => ({
    '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.mimeType, contentBytes: a.data,
  })) } : {}),
});

export const createOutlookDraft = (account: EmailAccountRow, input: any) =>
  graphRequest<OutlookMessage>(account, '/me/messages', { method: 'POST', body: JSON.stringify(graphMessage(input)) });
export const updateOutlookDraft = (account: EmailAccountRow, id: string, input: any) =>
  graphRequest<OutlookMessage>(account, `/me/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(graphMessage(input)) });
export const deleteOutlookDraft = (account: EmailAccountRow, id: string) =>
  graphRequest<void>(account, `/me/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
export async function sendOutlookDraft(account: EmailAccountRow, id: string) {
  await graphRequest<void>(account, `/me/messages/${encodeURIComponent(id)}/send`, { method: 'POST' });
  return { id, threadId: undefined };
}
export async function sendOutlookMessage(account: EmailAccountRow, input: any) {
  if (input.inReplyToMessageId) {
    const draft = await graphRequest<OutlookMessage>(account, `/me/messages/${encodeURIComponent(input.inReplyToMessageId)}/createReply`, { method: 'POST' });
    await updateOutlookDraft(account, draft.id, input);
    return sendOutlookDraft(account, draft.id);
  }
  const draft = await createOutlookDraft(account, input);
  await sendOutlookDraft(account, draft.id);
  return { id: draft.id, threadId: draft.conversationId };
}
export async function getOutlookAttachment(account: EmailAccountRow, messageId: string, attachmentId: string): Promise<string> {
  const result = await graphRequest<{ contentBytes?: string }>(account, `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
  return result.contentBytes || '';
}
export async function listOutlookAttachments(account: EmailAccountRow, messageId: string): Promise<EmailAttachment[]> {
  const result = await graphRequest<{ value: Array<{ id: string; name?: string; contentType?: string; size?: number }> }>(account, `/me/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size`);
  return result.value.map((a) => ({ attachmentId: a.id, filename: a.name || 'attachment', mimeType: a.contentType || 'application/octet-stream', size: a.size || 0 }));
}

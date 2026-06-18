import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts, getEmailAccount } from '@/lib/server/email-accounts';
import { getOutlookAttachment, getOutlookMessage, getOutlookThread, listOutlookAttachments, outlookMessageToEmail } from '@/lib/server/outlook-api';
import { findAccountForMessage } from '@/lib/server/email-sync';
import { fetchFullMessage, fetchFullThread, getAttachment } from '@/lib/server/gmail-api';
import type { Email, EmailAttachment } from '@/types';
import type { OpenAiInputPart } from '@/lib/server/openai';

export interface AiAccountPreference {
  accountId: string;
  accountEmail: string;
  displayName: string;
  writingStyle: string;
  signature: string;
  draftInstructions: string;
  aiEnabled: boolean;
}

export const DEFAULT_WRITING_STYLE = 'Concise, clear, warm, and professional.';
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_ATTACHMENT_CHARS = 10_000;
const MAX_MODEL_ATTACHMENTS = 6;

interface AiAttachmentContext {
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: 'text' | 'image' | 'file' | 'metadata';
  text?: string;
  dataUrl?: string;
  note?: string;
}

export async function getAccountPreference(
  userId: string,
  accountId: string,
  accountEmail: string,
  displayName = ''
): Promise<AiAccountPreference> {
  const { data, error } = await getSupabaseAdmin()
    .from('ai_account_preferences')
    .select('writing_style, signature, draft_instructions, ai_enabled')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .maybeSingle();

  // A missing migration should not prevent read-only AI features from working.
  if (error && error.code !== '42P01') throw error;

  return {
    accountId,
    accountEmail,
    displayName,
    writingStyle: data?.writing_style || DEFAULT_WRITING_STYLE,
    signature: data?.signature || '',
    draftInstructions: data?.draft_instructions || '',
    aiEnabled: data?.ai_enabled ?? true,
  };
}

export async function getThreadAiContext(userId: string, messageId: string, accountId?: string) {
  const accounts = await listEmailAccounts(userId);
  const account = accountId ? await getEmailAccount(userId, accountId) : await findAccountForMessage(userId, accounts as any, messageId) as any;
  if (!account) return null;

  if (account.provider === 'outlook') {
    const message = await getOutlookMessage(account, messageId);
    const email = outlookMessageToEmail(message, account.id);
    const messages = await getOutlookThread(account, message);
    const attachmentContexts = await loadOutlookAttachmentContexts(account, messages);
    const preference = await getAccountPreference(userId, account.id, account.email, '');
    return { email, messages, account, preference, attachmentContexts };
  }
  const client = await getAuthorizedClient(account as any);
  const result = await fetchFullMessage(client, messageId);
  if (!result) return null;

  const messages = result.email.threadId ? await fetchFullThread(client, result.email.threadId) : [result.email];
  const attachmentContexts = await loadGmailAttachmentContexts(client, messages);
  const preference = await getAccountPreference(
    userId,
    account.id,
    account.email,
    ''
  );

  return { email: result.email, messages, account, preference, attachmentContexts };
}

export function emailContextText(context: Awaited<ReturnType<typeof getThreadAiContext>>): string {
  if (!context) return '';
  const { email, messages, account } = context;
  const conversation = messages.map((message, index) => {
    const body = (message.bodyPlain || message.body || message.snippet || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12_000);
    return [
      `MESSAGE ${index + 1}`,
      `ID: ${message.id}`,
      `FROM: ${message.from.name} <${message.from.email}>`,
      `TO: ${message.to.map((recipient) => `${recipient.name} <${recipient.email}>`).join(', ')}`,
      `DATE: ${message.date}`,
      `BODY:\n${body}`,
      attachmentSummaryForMessage(context.attachmentContexts || [], message.id),
    ].join('\n');
  }).join('\n---\n').slice(0, 45_000);

  return [
    `ACCOUNT: ${account.email}`,
    `SELECTED_MESSAGE_ID: ${email.id}`,
    `THREAD_ID: ${email.threadId}`,
    `SUBJECT: ${email.subject}`,
    `CONVERSATION (${messages.length} messages):\n${conversation}`,
  ].join('\n');
}

export function emailContextInputParts(context: Awaited<ReturnType<typeof getThreadAiContext>>): OpenAiInputPart[] {
  if (!context?.attachmentContexts?.length) return [];
  return context.attachmentContexts
    .filter((attachment) => attachment.dataUrl && (attachment.kind === 'image' || attachment.kind === 'file'))
    .map((attachment) => attachment.kind === 'image'
      ? { type: 'input_image', image_url: attachment.dataUrl! }
      : { type: 'input_file', filename: attachment.filename, file_data: attachment.dataUrl! });
}

const isTextAttachment = (mimeType: string, filename: string) =>
  mimeType.startsWith('text/') ||
  ['application/json', 'application/xml', 'application/xhtml+xml', 'application/csv'].includes(mimeType) ||
  /\.(txt|csv|json|md|xml|html?|ics)$/i.test(filename);

const isImageAttachment = (mimeType: string) => /^image\/(png|jpe?g|gif|webp)$/i.test(mimeType);
const isPdfAttachment = (mimeType: string, filename: string) =>
  mimeType === 'application/pdf' || /\.pdf$/i.test(filename);

const normalizeBase64 = (value: string) => {
  const stripped = value.includes(',') ? value.split(',').pop() || '' : value;
  const clean = stripped.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  return clean.padEnd(Math.ceil(clean.length / 4) * 4, '=');
};

const decodeBase64Text = (value: string) =>
  Buffer.from(normalizeBase64(value), 'base64').toString('utf8').replace(/\0/g, '').trim();

const attachmentDataUrl = (attachment: EmailAttachment, data: string) =>
  `data:${attachment.mimeType || 'application/octet-stream'};base64,${normalizeBase64(data)}`;

async function buildAttachmentContext(
  messageId: string,
  attachment: EmailAttachment,
  fetchData: () => Promise<string>
): Promise<AiAttachmentContext> {
  const base = {
    messageId,
    filename: attachment.filename || 'attachment',
    mimeType: attachment.mimeType || 'application/octet-stream',
    size: attachment.size || 0,
  };

  if (!attachment.attachmentId && !attachment.data) {
    return { ...base, kind: 'metadata', note: 'No downloadable attachment id was available.' };
  }

  const canInline = !base.size || base.size <= MAX_ATTACHMENT_BYTES;
  if (!canInline) {
    return { ...base, kind: 'metadata', note: 'Attachment is too large to send directly to the model.' };
  }

  const data = attachment.data || await fetchData().catch(() => '');
  if (!data) return { ...base, kind: 'metadata', note: 'Attachment content could not be loaded.' };

  if (isTextAttachment(base.mimeType, base.filename)) {
    const text = decodeBase64Text(data).slice(0, MAX_TEXT_ATTACHMENT_CHARS);
    return { ...base, kind: 'text', text: text || '(empty text attachment)' };
  }

  if (isImageAttachment(base.mimeType)) {
    return { ...base, kind: 'image', dataUrl: attachmentDataUrl(attachment, data) };
  }

  if (isPdfAttachment(base.mimeType, base.filename)) {
    return { ...base, kind: 'file', dataUrl: attachmentDataUrl({ ...attachment, mimeType: 'application/pdf' }, data) };
  }

  return { ...base, kind: 'metadata', note: 'Attachment type is not supported for direct AI ingestion yet.' };
}

async function loadGmailAttachmentContexts(client: any, messages: Email[]): Promise<AiAttachmentContext[]> {
  const contexts: AiAttachmentContext[] = [];
  for (const message of messages) {
    for (const attachment of message.attachments || []) {
      if (contexts.length >= MAX_MODEL_ATTACHMENTS) return contexts;
      contexts.push(await buildAttachmentContext(message.id, attachment, () =>
        attachment.attachmentId ? getAttachment(client, message.id, attachment.attachmentId) : Promise.resolve(attachment.data || '')
      ));
    }
  }
  return contexts;
}

async function loadOutlookAttachmentContexts(account: any, messages: Email[]): Promise<AiAttachmentContext[]> {
  const contexts: AiAttachmentContext[] = [];
  for (const message of messages) {
    if (!message.hasAttachments && !message.attachments?.length) continue;
    const attachments = message.attachments?.length ? message.attachments : await listOutlookAttachments(account, message.id).catch(() => []);
    for (const attachment of attachments) {
      if (contexts.length >= MAX_MODEL_ATTACHMENTS) return contexts;
      contexts.push(await buildAttachmentContext(message.id, attachment, () =>
        attachment.attachmentId ? getOutlookAttachment(account, message.id, attachment.attachmentId) : Promise.resolve(attachment.data || '')
      ));
    }
  }
  return contexts;
}

function attachmentSummaryForMessage(attachments: AiAttachmentContext[], messageId: string): string {
  const scoped = attachments.filter((attachment) => attachment.messageId === messageId);
  if (!scoped.length) return 'ATTACHMENTS: none';
  const lines = scoped.map((attachment, index) => {
    const details = [
      `ATTACHMENT ${index + 1}: ${attachment.filename}`,
      `TYPE: ${attachment.mimeType}`,
      `SIZE_BYTES: ${attachment.size}`,
      `AI_CONTEXT: ${attachment.kind}`,
      attachment.note ? `NOTE: ${attachment.note}` : '',
      attachment.text ? `TEXT_EXCERPT:\n${attachment.text}` : '',
    ].filter(Boolean);
    return details.join('\n');
  });
  return `ATTACHMENTS:\n${lines.join('\n---\n')}`;
}

export type AiEmailContextRef = {
  messageId: string;
  accountId?: string;
};

export async function loadEmailContextsForAi(
  userId: string,
  refs: AiEmailContextRef[],
) {
  const contexts: NonNullable<Awaited<ReturnType<typeof getThreadAiContext>>>[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const key = `${ref.accountId || 'default'}:${ref.messageId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const context = await getThreadAiContext(userId, ref.messageId, ref.accountId);
    if (context) contexts.push(context);
  }

  return contexts;
}

export function combinedEmailContextText(
  contexts: NonNullable<Awaited<ReturnType<typeof getThreadAiContext>>>[],
): string {
  if (!contexts.length) return '';
  return contexts.map((context, index) => (
    `===== ATTACHED EMAIL ${index + 1} =====\n${emailContextText(context)}`
  )).join('\n\n');
}

export function combinedEmailContextInputParts(
  contexts: NonNullable<Awaited<ReturnType<typeof getThreadAiContext>>>[],
): OpenAiInputPart[] {
  return contexts.flatMap((context) => emailContextInputParts(context));
}

export type AiUserContextFile = {
  filename: string;
  mimeType: string;
  data: string;
};

export function parseUserContextFiles(files: AiUserContextFile[]): AiUserContextFile[] {
  const parsed: AiUserContextFile[] = [];
  for (const file of files.slice(0, MAX_MODEL_ATTACHMENTS)) {
    const data = normalizeBase64(file.data);
    let byteLength = 0;
    try {
      byteLength = Buffer.from(data, 'base64').length;
    } catch {
      continue;
    }
    if (byteLength > MAX_ATTACHMENT_BYTES) continue;

    const mimeType = file.mimeType || 'application/octet-stream';
    const filename = file.filename || 'upload';
    const allowed = isTextAttachment(mimeType, filename)
      || isImageAttachment(mimeType)
      || isPdfAttachment(mimeType, filename);
    if (!allowed) continue;

    parsed.push({ filename, mimeType, data });
  }
  return parsed;
}

export function userContextFilesTextSummary(files: AiUserContextFile[]): string {
  const lines = files.flatMap((file) => {
    const mimeType = file.mimeType || 'application/octet-stream';
    const filename = file.filename || 'upload';
    if (!isTextAttachment(mimeType, filename)) return [];
    const text = decodeBase64Text(file.data).slice(0, MAX_TEXT_ATTACHMENT_CHARS);
    return [`===== UPLOADED FILE: ${filename} =====\n${text || '(empty file)'}`];
  });
  return lines.join('\n\n');
}

export function userContextFileInputParts(files: AiUserContextFile[]): OpenAiInputPart[] {
  const parts: OpenAiInputPart[] = [];
  for (const file of files) {
    const mimeType = file.mimeType || 'application/octet-stream';
    const filename = file.filename || 'upload';
    const data = normalizeBase64(file.data);
    const dataUrl = `data:${mimeType};base64,${data}`;

    if (isImageAttachment(mimeType)) {
      parts.push({ type: 'input_image', image_url: dataUrl });
      continue;
    }
    if (isPdfAttachment(mimeType, filename)) {
      parts.push({ type: 'input_file', filename, file_data: dataUrl });
    }
  }
  return parts;
}

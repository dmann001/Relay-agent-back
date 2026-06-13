import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { listGmailAccounts, getAuthorizedClient, getGmailAccount } from '@/lib/server/gmail-accounts';
import { findAccountForMessage } from '@/lib/server/email-sync';
import { fetchFullMessage, fetchFullThread } from '@/lib/server/gmail-api';

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
  const accounts = await listGmailAccounts(userId);
  const account = accountId ? await getGmailAccount(userId, accountId) : await findAccountForMessage(userId, accounts, messageId);
  if (!account) return null;

  const client = await getAuthorizedClient(account);
  const result = await fetchFullMessage(client, messageId);
  if (!result) return null;

  const messages = result.email.threadId ? await fetchFullThread(client, result.email.threadId) : [result.email];
  const preference = await getAccountPreference(
    userId,
    account.id,
    account.email,
    ''
  );

  return { email: result.email, messages, account, preference };
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

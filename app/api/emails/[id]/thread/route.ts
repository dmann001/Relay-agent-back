import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts, getEmailAccount } from '@/lib/server/email-accounts';
import { getOutlookMessage, getOutlookThread, modifyOutlookMessage } from '@/lib/server/outlook-api';
import { findAccountForMessage, refreshCachedMessage } from '@/lib/server/email-sync';
import { fetchFullMessage, fetchFullThread, modifyMessage } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';
import { storeEmailEmbeddingChunk } from '@/lib/server/personalization';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id: messageId } = await params;
    const requestedAccountId = request.nextUrl.searchParams.get('accountId');
    const accounts = await listEmailAccounts(userId);
    const account = requestedAccountId
      ? await getEmailAccount(userId, requestedAccountId)
      : await findAccountForMessage(userId, accounts as any, messageId) as any;
    if (!account) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

    if (account.provider === 'outlook') {
      let selected = await getOutlookMessage(account, messageId);
      let readUpdateError: string | undefined;
      if (selected.isRead === false) {
        try {
          await modifyOutlookMessage(account, messageId, 'markRead');
          selected = await getOutlookMessage(account, messageId);
          const { error } = await getSupabaseAdmin().from('emails').update({
            is_read: true,
          }).eq('user_id', userId).eq('account_id', account.id).eq('provider_message_id', messageId);
          if (error) throw error;
        } catch (error: any) {
          readUpdateError = error?.message || 'Could not mark this email as read.';
        }
      }
      const messages = await getOutlookThread(account, selected);
      void Promise.all(messages.map((email) => storeEmailEmbeddingChunk({
        userId,
        accountId: account.id,
        providerMessageId: email.id,
        subject: email.subject,
        content: email.bodyPlain || email.body || email.snippet || '',
        source: 'opened_thread',
        contactEmail: email.from?.email,
      }))).catch((error) => console.error('[Thread] Failed to embed opened Outlook thread (non-fatal):', error));
      return NextResponse.json({
        messages: messages.map((email) => ({
          ...email,
          read: email.id === messageId && !readUpdateError ? true : email.read,
          accountEmail: account.email,
        })),
        accountId: account.id,
        accountEmail: account.email,
        threadId: selected.conversationId || selected.id,
        readUpdateError,
        readUpdatedMessageIds: !readUpdateError && selected.isRead === false ? [messageId] : [],
      });
    }
    const client = await getAuthorizedClient(account as any);
    const selected = await fetchFullMessage(client, messageId);
    if (!selected) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    const threadId = selected.email.threadId;
    let readUpdateError: string | undefined;
    if (!selected.email.read) {
      try {
        const labelIds = await modifyMessage(client, messageId, [], ['UNREAD']);
        await refreshCachedMessage(userId, account.id, { id: messageId, labelIds });
      } catch (error: any) {
        readUpdateError = error?.message || 'Could not mark this email as read.';
      }
    }
    const messages = threadId ? await fetchFullThread(client, threadId) : [selected.email];
    void Promise.all(messages.map((email) => storeEmailEmbeddingChunk({
      userId,
      accountId: account.id,
      providerMessageId: email.id,
      subject: email.subject,
      content: email.bodyPlain || email.body || email.snippet || '',
      source: 'opened_thread',
      contactEmail: email.from?.email,
    }))).catch((error) => console.error('[Thread] Failed to embed opened Gmail thread (non-fatal):', error));

    return NextResponse.json({
      messages: messages.map((email) => ({
        ...email,
        read: email.id === messageId && !readUpdateError ? true : email.read,
        accountId: account.id,
        accountEmail: account.email,
      })),
      accountId: account.id,
      accountEmail: account.email,
      threadId,
      readUpdateError,
      readUpdatedMessageIds: !readUpdateError && !selected.email.read ? [messageId] : [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

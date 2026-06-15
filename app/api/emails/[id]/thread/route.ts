import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts, getEmailAccount } from '@/lib/server/email-accounts';
import { getOutlookMessage, getOutlookThread } from '@/lib/server/outlook-api';
import { findAccountForMessage } from '@/lib/server/email-sync';
import { fetchFullMessage, fetchFullThread } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';

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
      const selected = await getOutlookMessage(account, messageId);
      const messages = await getOutlookThread(account, selected);
      return NextResponse.json({ messages: messages.map((email) => ({ ...email, accountEmail: account.email })),
        accountId: account.id, accountEmail: account.email, threadId: selected.conversationId || selected.id });
    }
    const client = await getAuthorizedClient(account as any);
    const selected = await fetchFullMessage(client, messageId);
    if (!selected) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    const threadId = selected.email.threadId;
    const messages = threadId ? await fetchFullThread(client, threadId) : [selected.email];

    return NextResponse.json({
      messages: messages.map((email) => ({ ...email, accountId: account.id, accountEmail: account.email })),
      accountId: account.id,
      accountEmail: account.email,
      threadId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

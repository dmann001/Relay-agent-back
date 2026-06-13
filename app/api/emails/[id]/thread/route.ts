import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, getAuthorizedClient, getGmailAccount } from '@/lib/server/gmail-accounts';
import { findAccountForMessage } from '@/lib/server/email-sync';
import { fetchFullMessage, fetchFullThread } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(request);
    const { id: messageId } = await params;
    const requestedAccountId = request.nextUrl.searchParams.get('accountId');
    const accounts = await listGmailAccounts(userId);
    const account = requestedAccountId
      ? await getGmailAccount(userId, requestedAccountId)
      : await findAccountForMessage(userId, accounts, messageId);
    if (!account) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

    const client = await getAuthorizedClient(account);
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

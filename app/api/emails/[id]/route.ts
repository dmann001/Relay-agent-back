// Single email - full body fetched LIVE from Gmail (the DB only stores metadata).
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts, getEmailAccount } from '@/lib/server/email-accounts';
import { getOutlookMessage, listOutlookAttachments, outlookMessageToEmail } from '@/lib/server/outlook-api';
import { findAccountForMessage, refreshCachedMessage } from '@/lib/server/email-sync';
import { fetchFullMessage } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUser(request);
    const { id: messageId } = await params;

    const accounts = await listEmailAccounts(userId);
    if (accounts.length === 0) {
      return NextResponse.json({ error: 'No email accounts connected' }, { status: 404 });
    }

    const requestedAccountId = request.nextUrl.searchParams.get('accountId');
    const account = requestedAccountId
      ? await getEmailAccount(userId, requestedAccountId)
      : await findAccountForMessage(userId, accounts as any, messageId) as any;
    if (!account) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (account.provider === 'outlook') {
      const message = await getOutlookMessage(account, messageId);
      const email = outlookMessageToEmail(message, account.id);
      if (message.hasAttachments) email.attachments = await listOutlookAttachments(account, messageId);
      return NextResponse.json({ email: { ...email, accountEmail: account.email }, accountId: account.id });
    }
    const client = await getAuthorizedClient(account as any);
    const result = await fetchFullMessage(client, messageId);
    if (!result) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Keep the cached metadata flags in step with what Gmail returned.
    await refreshCachedMessage(userId, account.id, {
      id: messageId,
      labelIds: result.labelIds,
    }).catch(() => {});

    return NextResponse.json({
      email: { ...result.email, accountId: account.id, accountEmail: account.email },
      accountId: account.id,
    });
  } catch (error: any) {
    if (error?.code === 404 || error?.response?.status === 404) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }
    return handleApiError(error);
  }
}

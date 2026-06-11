// Single email - full body fetched LIVE from Gmail (the DB only stores metadata).
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, getAuthorizedClient } from '@/lib/server/gmail-accounts';
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

    const accounts = await listGmailAccounts(userId);
    if (accounts.length === 0) {
      return NextResponse.json({ error: 'No Gmail accounts connected' }, { status: 404 });
    }

    const account = await findAccountForMessage(userId, accounts, messageId);
    if (!account) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const client = await getAuthorizedClient(account);
    const result = await fetchFullMessage(client, messageId);
    if (!result) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Keep the cached metadata flags in step with what Gmail returned.
    await refreshCachedMessage(userId, account.id, {
      id: messageId,
      labelIds: result.labelIds,
    }).catch(() => {});

    return NextResponse.json({ email: result.email, accountId: account.id });
  } catch (error: any) {
    if (error?.code === 404 || error?.response?.status === 404) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }
    return handleApiError(error);
  }
}

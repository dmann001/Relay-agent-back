// Attachment download - fetched live from Gmail.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { findAccountForMessage } from '@/lib/server/email-sync';
import { getAttachment } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const { messageId, attachmentId } = await request.json();

    if (!messageId || !attachmentId) {
      return NextResponse.json(
        { error: 'messageId and attachmentId are required' },
        { status: 400 }
      );
    }

    const accounts = await listGmailAccounts(userId);
    const account = await findAccountForMessage(userId, accounts, messageId);
    if (!account) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const client = await getAuthorizedClient(account);
    const data = await getAttachment(client, messageId, attachmentId);

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

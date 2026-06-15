// Attachment download - fetched live from Gmail.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts } from '@/lib/server/email-accounts';
import { getOutlookAttachment } from '@/lib/server/outlook-api';
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

    const accounts = await listEmailAccounts(userId);
    const account = await findAccountForMessage(userId, accounts as any, messageId) as any;
    if (!account) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (account.provider === 'outlook') {
      return NextResponse.json({ data: await getOutlookAttachment(account, messageId, attachmentId) });
    }
    const client = await getAuthorizedClient(account as any);
    const data = await getAttachment(client, messageId, attachmentId);

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

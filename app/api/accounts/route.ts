// Connected Gmail accounts (token-free view for the frontend).
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, deleteGmailAccount } from '@/lib/server/gmail-accounts';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const accounts = await listGmailAccounts(userId);

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        provider: 'gmail',
        connectedAt: account.connected_at,
        lastSyncedAt: account.last_sync_at,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const accountId = request.nextUrl.searchParams.get('id');
    if (!accountId) {
      return NextResponse.json({ error: 'Account id is required' }, { status: 400 });
    }

    await deleteGmailAccount(userId, accountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

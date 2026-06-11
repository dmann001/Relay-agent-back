// Sync trigger: pulls the latest changes from Gmail into the DB metadata cache.
// Called on login, when the user opens/refreshes a mailbox, and periodically.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, updateSyncState } from '@/lib/server/gmail-accounts';
import { syncAccount, type Mailbox, type SyncResult } from '@/lib/server/email-sync';
import { handleApiError } from '@/lib/server/api-utils';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const mailbox = body?.mailbox as Mailbox | undefined;
    const force = body?.force === true;
    const loadMore = body?.loadMore === true;

    const accounts = await listGmailAccounts(userId);
    if (accounts.length === 0) {
      return NextResponse.json({ results: [], message: 'No Gmail accounts connected' });
    }

    const results: SyncResult[] = [];
    for (const account of accounts) {
      try {
        results.push(await syncAccount(userId, account, { mailbox, force, loadMore }));
      } catch (error: any) {
        const message =
          error?.message ||
          error?.code ||
          (typeof error === 'string' ? error : 'Sync failed');
        console.error(`[Sync] Failed for ${account.email}:`, message, error);
        await updateSyncState(account.id, { last_error: message }).catch(() => {});
        results.push({
          accountId: account.id,
          email: account.email,
          synced: 0,
          deleted: 0,
          mode: 'incremental',
          error: message,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}

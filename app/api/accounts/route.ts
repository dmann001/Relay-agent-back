// Connected Gmail accounts (token-free view for the frontend).
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { listEmailAccounts, deleteEmailAccount } from '@/lib/server/email-accounts';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const accounts = await listEmailAccounts(userId);
    const accountIds = accounts.map(({ id }) => id);
    const { data: syncStates, error: syncError } = accountIds.length
      ? await getSupabaseAdmin()
          .from('email_sync_state')
          .select('account_id, last_successful_sync_at, last_error')
          .in('account_id', accountIds)
      : { data: [], error: null };
    if (syncError) throw syncError;
    const syncByAccount = new Map((syncStates || []).map((state) => [state.account_id, state]));
    const unreadEntries = await Promise.all(accounts.map(async (account) => {
      const { count, error } = await getSupabaseAdmin()
        .from('emails').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('account_id', account.id).eq('is_inbox', true).eq('is_trashed', false).eq('is_read', false);
      if (error) throw error;
      return [account.id, count || 0] as const;
    }));
    const unreadByAccount = new Map(unreadEntries);

    return NextResponse.json({
      accounts: accounts.map((account) => {
        const sync = syncByAccount.get(account.id);
        return ({
        id: account.id,
        email: account.email,
        provider: account.provider,
        connectedAt: account.connected_at,
        lastSyncedAt: sync?.last_successful_sync_at || account.last_sync_at,
        syncStatus: sync?.last_error ? 'error' : (sync?.last_successful_sync_at || account.last_sync_at) ? 'healthy' : 'never',
        lastError: sync?.last_error || null,
        unreadCount: unreadByAccount.get(account.id) || 0,
      }); }),
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

    await deleteEmailAccount(userId, accountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

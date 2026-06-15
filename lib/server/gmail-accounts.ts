// Server-side Gmail account storage: encrypted tokens in `email_accounts`,
// sync bookkeeping in `email_sync_state`. Tokens never leave the server.
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { encryptSecret, decryptSecretOrPassthrough } from '@/lib/server/crypto';

export interface GmailAccountRow {
  id: string;
  user_id: string;
  email: string;
  provider_account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  last_sync_at: string | null;
}

export type MailboxPageTokens = {
  inbox?: string | null;
  sent?: string | null;
  archive?: string | null;
  trash?: string | null;
  drafts?: string | null;
  primary?: string | null;
  social?: string | null;
  promotions?: string | null;
  updates?: string | null;
  forums?: string | null;
};

export interface SyncStateRow {
  account_id: string;
  history_id: string | null;
  pagination_token: string | null;
  last_successful_sync_at: string | null;
  initial_sync_done: boolean;
  trash_synced_at: string | null;
  last_error: string | null;
}

export function parseMailboxPageTokens(raw: string | null | undefined): MailboxPageTokens {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MailboxPageTokens;
    return {
      inbox: parsed.inbox ?? null,
      sent: parsed.sent ?? null,
      archive: parsed.archive ?? null,
      trash: parsed.trash ?? null,
      drafts: parsed.drafts ?? null,
      primary: parsed.primary ?? null,
      social: parsed.social ?? null,
      promotions: parsed.promotions ?? null,
      updates: parsed.updates ?? null,
      forums: parsed.forums ?? null,
    };
  } catch {
    // Legacy: a single opaque token string was stored for inbox pagination.
    return { inbox: raw };
  }
}

export function mergeMailboxPageTokens(
  current: string | null | undefined,
  update: Partial<MailboxPageTokens>
): string {
  const tokens = { ...parseMailboxPageTokens(current), ...update };
  return JSON.stringify(tokens);
}

const ACCOUNT_COLUMNS =
  'id, user_id, email, provider_account_id, access_token, refresh_token, token_expires_at, connected_at, last_sync_at';

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function saveGmailAccount(params: {
  userId: string;
  email: string;
  providerAccountId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  scopes?: string[];
}): Promise<GmailAccountRow> {
  const supabase = getSupabaseAdmin();

  // Preserve an existing refresh token when Google does not return a new one.
  const { data: existing } = await supabase
    .from('email_accounts')
    .select('id, refresh_token')
    .eq('user_id', params.userId)
    .eq('provider', 'gmail')
    .eq('email', params.email)
    .maybeSingle();

  const refreshToken = params.refreshToken
    ? encryptSecret(params.refreshToken)
    : existing?.refresh_token ?? null;

  const { data, error } = await supabase
    .from('email_accounts')
    .upsert(
      {
        user_id: params.userId,
        provider: 'gmail',
        provider_account_id: params.providerAccountId ?? null,
        email: params.email,
        access_token: encryptSecret(params.accessToken),
        refresh_token: refreshToken,
        token_expires_at: params.expiryDate ? new Date(params.expiryDate).toISOString() : null,
        scopes: params.scopes ?? [],
        revoked_at: null,
      },
      { onConflict: 'user_id,provider,email' }
    )
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) throw error;

  // Ensure a sync-state row exists for this account.
  await supabase
    .from('email_sync_state')
    .upsert({ account_id: data.id }, { onConflict: 'account_id', ignoreDuplicates: true });

  return data as GmailAccountRow;
}

export async function listGmailAccounts(userId: string): Promise<GmailAccountRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('user_id', userId)
    .eq('provider', 'gmail')
    .is('revoked_at', null)
    .order('connected_at', { ascending: true });

  if (error) throw error;
  return (data || []) as GmailAccountRow[];
}

export async function getGmailAccount(userId: string, accountId: string): Promise<GmailAccountRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('user_id', userId)
    .eq('id', accountId)
    .is('revoked_at', null)
    .maybeSingle();

  if (error) throw error;
  return (data as GmailAccountRow) ?? null;
}

export async function deleteGmailAccount(userId: string, accountId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('email_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('id', accountId);
  if (error) throw error;
}

// Returns an authorized OAuth2 client for the account. Refreshed access
// tokens are persisted back to the DB (encrypted).
export async function getAuthorizedClient(account: GmailAccountRow): Promise<OAuth2Client> {
  if (!account.access_token) {
    throw new Error('Account has no access token; reconnect Gmail');
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: decryptSecretOrPassthrough(account.access_token),
    refresh_token: account.refresh_token
      ? decryptSecretOrPassthrough(account.refresh_token)
      : undefined,
    expiry_date: account.token_expires_at ? new Date(account.token_expires_at).getTime() : undefined,
  });

  if (account.refresh_token) {
    const before = client.credentials.access_token;
    const { token } = await client.getAccessToken();
    if (token && token !== before) {
      await getSupabaseAdmin()
        .from('email_accounts')
        .update({
          access_token: encryptSecret(token),
          token_expires_at: client.credentials.expiry_date
            ? new Date(client.credentials.expiry_date).toISOString()
            : null,
        })
        .eq('id', account.id);
    }
  }

  return client;
}

export async function getSyncState(accountId: string): Promise<SyncStateRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('email_sync_state')
    .select('account_id, history_id, pagination_token, last_successful_sync_at, initial_sync_done, trash_synced_at, last_error')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) throw error;
  return (data as SyncStateRow) ?? null;
}

export async function updateSyncState(
  accountId: string,
  updates: Partial<Omit<SyncStateRow, 'account_id'>>
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('email_sync_state')
    .upsert({ account_id: accountId, ...updates }, { onConflict: 'account_id' });
  if (error) throw error;
}

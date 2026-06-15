import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import type { EmailProvider } from '@/types';

export interface EmailAccountRow {
  id: string;
  user_id: string;
  email: string;
  provider: EmailProvider;
  provider_account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  last_sync_at: string | null;
  scopes?: string[] | null;
}

const COLUMNS =
  'id, user_id, email, provider, provider_account_id, access_token, refresh_token, token_expires_at, connected_at, last_sync_at, scopes';

export async function listEmailAccounts(userId: string): Promise<EmailAccountRow[]> {
  const { data, error } = await getSupabaseAdmin().from('email_accounts').select(COLUMNS)
    .eq('user_id', userId).is('revoked_at', null).order('connected_at', { ascending: true });
  if (error) throw error;
  return (data || []) as EmailAccountRow[];
}

export async function getEmailAccount(userId: string, accountId: string): Promise<EmailAccountRow | null> {
  const { data, error } = await getSupabaseAdmin().from('email_accounts').select(COLUMNS)
    .eq('user_id', userId).eq('id', accountId).is('revoked_at', null).maybeSingle();
  if (error) throw error;
  return data as EmailAccountRow | null;
}

export async function deleteEmailAccount(userId: string, accountId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from('email_accounts').delete()
    .eq('user_id', userId).eq('id', accountId);
  if (error) throw error;
}

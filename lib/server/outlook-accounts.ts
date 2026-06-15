import { decryptSecretOrPassthrough, encryptSecret } from '@/lib/server/crypto';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import type { EmailAccountRow } from '@/lib/server/email-accounts';

const authority = () => `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0`;
export const OUTLOOK_SCOPES = ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send'];

type MicrosoftOAuthErrorPayload = {
  error?: string;
  error_description?: string;
  error_codes?: number[];
};

export class OutlookOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'OutlookOAuthError';
  }
}

export type OutlookProfile = {
  id?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  userType?: string | null;
};

export function isOutlookGuestProfile(profile: OutlookProfile): boolean {
  return profile.userType?.toLowerCase() === 'guest'
    || profile.userPrincipalName?.toUpperCase().includes('#EXT#') === true;
}

export function validateOutlookOAuthConfig() {
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET || !process.env.MICROSOFT_REDIRECT_URI) {
    throw new OutlookOAuthError('Outlook integration is not configured', 'outlook_not_configured');
  }
}

export function createOutlookAuthorizationUrl(state: string): string {
  validateOutlookOAuthConfig();
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
    response_mode: 'query',
    scope: OUTLOOK_SCOPES.join(' '),
    state,
    prompt: 'select_account',
  });
  return `${authority()}/authorize?${params}`;
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch(`${authority()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const payload = await response.json() as MicrosoftOAuthErrorPayload & {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!response.ok) {
    const description = payload.error_description || payload.error || 'Microsoft token exchange failed';
    const errorCodes = payload.error_codes || [];
    const code = errorCodes.includes(7000215) || description.includes('AADSTS7000215')
      ? 'invalid_client_secret'
      : errorCodes.includes(700016) || description.includes('AADSTS700016')
        ? 'invalid_client_id'
        : errorCodes.includes(50011) || description.includes('AADSTS50011')
          ? 'invalid_redirect_uri'
          : 'auth_failed';
    throw new OutlookOAuthError(description, code);
  }
  return payload as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

export function exchangeOutlookCode(code: string) {
  return tokenRequest(new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
    code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
    grant_type: 'authorization_code',
    scope: OUTLOOK_SCOPES.join(' '),
  }));
}

export async function saveOutlookAccount(params: {
  userId: string; email: string; providerAccountId: string; accessToken: string;
  refreshToken?: string; expiresIn?: number; scopes?: string[];
}) {
  const db = getSupabaseAdmin();
  const { data: existing } = await db.from('email_accounts').select('refresh_token')
    .eq('user_id', params.userId).eq('provider', 'outlook').eq('email', params.email).maybeSingle();
  const { data, error } = await db.from('email_accounts').upsert({
    user_id: params.userId, provider: 'outlook', email: params.email,
    provider_account_id: params.providerAccountId,
    access_token: encryptSecret(params.accessToken),
    refresh_token: params.refreshToken ? encryptSecret(params.refreshToken) : existing?.refresh_token ?? null,
    token_expires_at: params.expiresIn ? new Date(Date.now() + params.expiresIn * 1000).toISOString() : null,
    scopes: params.scopes || OUTLOOK_SCOPES, revoked_at: null,
  }, { onConflict: 'user_id,provider,email' }).select('*').single();
  if (error) throw error;
  await db.from('email_sync_state').upsert({ account_id: data.id }, { onConflict: 'account_id', ignoreDuplicates: true });
  return data;
}

export async function getOutlookAccessToken(account: EmailAccountRow, forceRefresh = false): Promise<string> {
  if (!account.access_token) throw new Error('Account has no access token; reconnect Outlook');
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (!forceRefresh && expiresAt > Date.now() + 60_000) return decryptSecretOrPassthrough(account.access_token);
  if (!account.refresh_token) throw new Error('Outlook session expired; reconnect Outlook');
  const tokens = await tokenRequest(new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
    refresh_token: decryptSecretOrPassthrough(account.refresh_token),
    grant_type: 'refresh_token',
    scope: OUTLOOK_SCOPES.join(' '),
  }));
  const encryptedAccessToken = encryptSecret(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : account.refresh_token;
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  await getSupabaseAdmin().from('email_accounts').update({
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    token_expires_at: tokenExpiresAt,
  }).eq('id', account.id);
  account.access_token = encryptedAccessToken;
  account.refresh_token = encryptedRefreshToken;
  account.token_expires_at = tokenExpiresAt;
  return tokens.access_token;
}

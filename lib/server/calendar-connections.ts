import { google } from 'googleapis';
import { decryptSecretOrPassthrough, encryptSecret } from '@/lib/server/crypto';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import type { EmailProvider } from '@/types';

export const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];
export const OUTLOOK_CALENDAR_SCOPES = [
  'openid', 'profile', 'email', 'offline_access', 'User.Read', 'Calendars.ReadWrite',
];

export type CalendarConnectionRow = {
  id: string;
  user_id: string;
  account_id: string;
  provider: EmailProvider;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  default_calendar_id: string;
  status: 'connected' | 'error' | 'revoked';
  last_verified_at: string | null;
  last_error: string | null;
};

const calendarRedirectUri = (provider: EmailProvider) => {
  const explicit = provider === 'gmail'
    ? process.env.GOOGLE_CALENDAR_REDIRECT_URI
    : process.env.MICROSOFT_CALENDAR_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  return explicit || `${appUrl}/api/calendar/callback/${provider}`;
};

export function createGoogleCalendarOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth is not configured');
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    calendarRedirectUri('gmail'),
  );
}

const microsoftAuthority = () =>
  `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0`;

export function createCalendarAuthorizationUrl(provider: EmailProvider, state: string) {
  if (provider === 'gmail') {
    return createGoogleCalendarOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    });
  }
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    throw new Error('Microsoft OAuth is not configured');
  }
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: calendarRedirectUri('outlook'),
    response_mode: 'query',
    scope: OUTLOOK_CALENDAR_SCOPES.join(' '),
    state,
    prompt: 'select_account',
  });
  return `${microsoftAuthority()}/authorize?${params}`;
}

async function microsoftTokenRequest(params: URLSearchParams) {
  const response = await fetch(`${microsoftAuthority()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const payload = await response.json() as {
    access_token?: string; refresh_token?: string; expires_in?: number; scope?: string;
    error?: string; error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Microsoft calendar authorization failed');
  }
  return payload as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

export function exchangeMicrosoftCalendarCode(code: string) {
  return microsoftTokenRequest(new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || '',
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
    code,
    redirect_uri: calendarRedirectUri('outlook'),
    grant_type: 'authorization_code',
    scope: OUTLOOK_CALENDAR_SCOPES.join(' '),
  }));
}

export async function saveCalendarConnection(input: {
  userId: string; accountId: string; provider: EmailProvider; accessToken: string;
  refreshToken?: string | null; expiresAt?: string | null; scopes: string[];
}) {
  const db = getSupabaseAdmin();
  const { data: existing } = await db.from('calendar_connections').select('refresh_token')
    .eq('user_id', input.userId).eq('account_id', input.accountId).maybeSingle();
  const { data, error } = await db.from('calendar_connections').upsert({
    user_id: input.userId,
    account_id: input.accountId,
    provider: input.provider,
    access_token: encryptSecret(input.accessToken),
    refresh_token: input.refreshToken ? encryptSecret(input.refreshToken) : existing?.refresh_token ?? null,
    token_expires_at: input.expiresAt ?? null,
    scopes: input.scopes,
    status: 'connected',
    last_verified_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: 'user_id,account_id' }).select('*').single();
  if (error) throw error;
  return data as CalendarConnectionRow;
}

export async function listCalendarConnections(userId: string): Promise<CalendarConnectionRow[]> {
  const { data, error } = await getSupabaseAdmin().from('calendar_connections').select('*')
    .eq('user_id', userId).neq('status', 'revoked');
  if (error) throw error;
  return (data || []) as CalendarConnectionRow[];
}

export async function getCalendarConnection(userId: string, accountId: string) {
  const { data, error } = await getSupabaseAdmin().from('calendar_connections').select('*')
    .eq('user_id', userId).eq('account_id', accountId).eq('status', 'connected').maybeSingle();
  if (error) throw error;
  return data as CalendarConnectionRow | null;
}

export async function getCalendarAccessToken(connection: CalendarConnectionRow, forceRefresh = false) {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (!forceRefresh && expiresAt > Date.now() + 60_000) {
    return decryptSecretOrPassthrough(connection.access_token);
  }
  if (!connection.refresh_token) throw new Error('Calendar permission expired; reconnect the calendar');

  let accessToken: string;
  let refreshToken: string | undefined;
  let expiresAtIso: string;
  if (connection.provider === 'gmail') {
    const client = createGoogleCalendarOAuthClient();
    client.setCredentials({ refresh_token: decryptSecretOrPassthrough(connection.refresh_token) });
    const tokens = await client.refreshAccessToken();
    if (!tokens.credentials.access_token) throw new Error('Google did not return a calendar access token');
    accessToken = tokens.credentials.access_token;
    refreshToken = tokens.credentials.refresh_token || undefined;
    expiresAtIso = new Date(tokens.credentials.expiry_date || Date.now() + 3600_000).toISOString();
  } else {
    const tokens = await microsoftTokenRequest(new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      refresh_token: decryptSecretOrPassthrough(connection.refresh_token),
      grant_type: 'refresh_token',
      scope: OUTLOOK_CALENDAR_SCOPES.join(' '),
    }));
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    expiresAtIso = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  }
  const encryptedAccess = encryptSecret(accessToken);
  const encryptedRefresh = refreshToken ? encryptSecret(refreshToken) : connection.refresh_token;
  await getSupabaseAdmin().from('calendar_connections').update({
    access_token: encryptedAccess, refresh_token: encryptedRefresh, token_expires_at: expiresAtIso,
    status: 'connected', last_verified_at: new Date().toISOString(), last_error: null,
  }).eq('id', connection.id);
  connection.access_token = encryptedAccess;
  connection.refresh_token = encryptedRefresh;
  connection.token_expires_at = expiresAtIso;
  return accessToken;
}

export function serializeCalendarConnection(row: CalendarConnectionRow, account?: { email: string } | null) {
  return {
    id: row.id,
    accountId: row.account_id,
    accountEmail: account?.email ?? null,
    provider: row.provider,
    status: row.status,
    scopes: row.scopes,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error,
  };
}

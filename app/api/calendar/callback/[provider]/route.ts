import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import {
  createGoogleCalendarOAuthClient,
  exchangeMicrosoftCalendarCode,
  GOOGLE_CALENDAR_SCOPES,
  OUTLOOK_CALENDAR_SCOPES,
  saveCalendarConnection,
} from '@/lib/server/calendar-connections';
import { parseOAuthState } from '@/lib/server/crypto';
import { getEmailAccount } from '@/lib/server/email-accounts';

const settingsUrl = (request: NextRequest, values: Record<string, string>) => {
  const url = new URL('/settings', request.nextUrl.origin);
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const oauthError = request.nextUrl.searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(settingsUrl(request, { calendarError: oauthError, provider }));
  }
  try {
    if (provider !== 'gmail' && provider !== 'outlook') throw new Error('Unsupported calendar provider');
    const code = request.nextUrl.searchParams.get('code');
    const stateValue = request.nextUrl.searchParams.get('state');
    if (!code || !stateValue) throw new Error('Calendar authorization did not return a code');
    const state = parseOAuthState(stateValue);
    if (state.purpose !== 'calendar' || !state.accountId || state.provider !== provider) {
      throw new Error('Invalid calendar OAuth state');
    }
    const account = await getEmailAccount(state.userId, state.accountId);
    if (!account || account.provider !== provider) throw new Error('Email account not found');

    if (provider === 'gmail') {
      const client = createGoogleCalendarOAuthClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.access_token) throw new Error('Google did not return an access token');
      client.setCredentials(tokens);
      const profile = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
      if (profile.data.email?.toLowerCase() !== account.email.toLowerCase()) {
        throw new Error(`Authorize Calendar with ${account.email}`);
      }
      await saveCalendarConnection({
        userId: state.userId,
        accountId: account.id,
        provider: 'gmail',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scopes: tokens.scope?.split(' ') || GOOGLE_CALENDAR_SCOPES,
      });
    } else {
      const tokens = await exchangeMicrosoftCalendarCode(code);
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileResponse.json() as { mail?: string; userPrincipalName?: string };
      const email = profile.mail || profile.userPrincipalName;
      if (!profileResponse.ok || email?.toLowerCase() !== account.email.toLowerCase()) {
        throw new Error(`Authorize Calendar with ${account.email}`);
      }
      await saveCalendarConnection({
        userId: state.userId,
        accountId: account.id,
        provider: 'outlook',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        scopes: tokens.scope?.split(' ') || OUTLOOK_CALENDAR_SCOPES,
      });
    }
    return NextResponse.redirect(settingsUrl(request, { calendarConnected: '1', accountId: account.id }));
  } catch (error) {
    console.error('[Calendar OAuth]', error);
    return NextResponse.redirect(settingsUrl(request, {
      calendarError: error instanceof Error ? error.message : 'Calendar authorization failed',
      provider,
    }));
  }
}

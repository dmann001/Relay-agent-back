// Gmail OAuth - callback handler.
// Stores encrypted tokens server-side in `email_accounts`; tokens are never
// sent to the browser. The frontend triggers the initial sync afterwards.
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { parseOAuthState } from '@/lib/server/crypto';
import { createOAuthClient, saveGmailAccount } from '@/lib/server/gmail-accounts';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${appUrl()}/settings?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl()}/settings?error=no_code`);
  }

  try {
    const { userId } = parseOAuthState(state);

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) throw new Error('No access token returned by Google');
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: userInfo } = await oauth2.userinfo.get();
    if (!userInfo.email) throw new Error('Could not resolve Gmail address');

    await saveGmailAccount({
      userId,
      email: userInfo.email,
      providerAccountId: userInfo.id ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ?? null,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
    });

    return NextResponse.redirect(
      `${appUrl()}/inbox?gmail_auth=success&gmail_email=${encodeURIComponent(userInfo.email)}`
    );
  } catch (err) {
    console.error('Error in Gmail OAuth callback:', err);
    return NextResponse.redirect(`${appUrl()}/settings?error=auth_failed`);
  }
}

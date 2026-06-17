import { NextRequest, NextResponse } from 'next/server';
import { parseOAuthState } from '@/lib/server/crypto';
import {
  exchangeOutlookCode,
  isOutlookGuestProfile,
  OutlookOAuthError,
  saveOutlookAccount,
} from '@/lib/server/outlook-accounts';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if (query.get('error')) return NextResponse.redirect(`${appUrl()}/settings/connections?provider=outlook&error=${encodeURIComponent(query.get('error')!)}`);
  const code = query.get('code'); const state = query.get('state');
  if (!code || !state) return NextResponse.redirect(`${appUrl()}/settings/connections?provider=outlook&error=no_code`);
  try {
    const { userId } = parseOAuthState(state);
    const tokens = await exchangeOutlookCode(code);
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,userType', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) throw new Error(profile?.error?.message || 'Could not resolve Outlook profile');
    if (isOutlookGuestProfile(profile)) {
      throw new OutlookOAuthError(
        'The selected Microsoft identity is an Entra guest and does not expose its Outlook mailbox',
        'guest_mailbox_unavailable',
      );
    }
    const mailboxResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox?$select=id', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!mailboxResponse.ok) {
      const mailboxError = await mailboxResponse.json().catch(() => ({}));
      console.error('[Outlook OAuth] mailbox validation failed:', mailboxResponse.status, mailboxError?.error?.code);
      throw new OutlookOAuthError(
        mailboxError?.error?.message || 'The selected Microsoft identity has no accessible Outlook mailbox',
        mailboxResponse.status === 403 ? 'missing_mail_permissions' : 'mailbox_unavailable',
      );
    }
    const email = profile.mail || profile.userPrincipalName;
    if (!email || !profile.id) throw new Error('Could not resolve Outlook email address');
    await saveOutlookAccount({
      userId, email, providerAccountId: profile.id, accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in,
      scopes: tokens.scope?.split(' '),
    });
    return NextResponse.redirect(`${appUrl()}/inbox?outlook_auth=success&outlook_email=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('[Outlook OAuth] callback failed:', error);
    const errorCode = error instanceof OutlookOAuthError ? error.code : 'auth_failed';
    return NextResponse.redirect(`${appUrl()}/settings/connections?provider=outlook&error=${encodeURIComponent(errorCode)}`);
  }
}

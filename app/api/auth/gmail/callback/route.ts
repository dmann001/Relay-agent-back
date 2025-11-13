// Gmail OAuth - Callback handler
import { NextRequest, NextResponse } from 'next/server';
import { gmail } from '@/lib/gmail';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=no_code`
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await gmail.getTokens(code);

    // Get user info
    const userInfo = await gmail.getUserInfo(tokens.access_token!);

    // Create account data
    const accountData = {
      id: `gmail_${userInfo.id}`,
      email: userInfo.email!,
      provider: 'gmail' as const,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      name: userInfo.name,
      picture: userInfo.picture,
    };

    // Encode account data to pass to client
    const encodedData = encodeURIComponent(JSON.stringify(accountData));

    // Redirect back to settings with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?gmail_auth=success&account=${encodedData}`
    );
  } catch (error) {
    console.error('Error in Gmail OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=auth_failed`
    );
  }
}

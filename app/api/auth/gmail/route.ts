// Gmail OAuth - start flow.
// Requires a Supabase session; the OAuth `state` binds the Google callback
// to the Relay user so tokens can be stored server-side.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { createOAuthState } from '@/lib/server/crypto';
import { createOAuthClient } from '@/lib/server/gmail-accounts';
import { handleApiError } from '@/lib/server/api-utils';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);

    const url = createOAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: createOAuthState(userId),
    });

    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error);
  }
}

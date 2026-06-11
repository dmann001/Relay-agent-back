import { NextResponse } from 'next/server';
import { UnauthorizedError } from '@/lib/server/supabase-admin';

export function handleApiError(error: any): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message, code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const status = error?.code ?? error?.response?.status;

  if (status === 401 || error?.message?.includes('invalid_grant')) {
    return NextResponse.json(
      {
        error: 'Authentication expired',
        message: 'Please reconnect your Gmail account in Settings',
        code: 'AUTH_EXPIRED',
      },
      { status: 401 }
    );
  }

  if (status === 403 || error?.message?.includes('Gmail API has not been used')) {
    return NextResponse.json(
      {
        error: 'Gmail API access denied',
        message: 'Check that the Gmail API is enabled and required scopes were granted.',
        code: 'GMAIL_FORBIDDEN',
      },
      { status: 403 }
    );
  }

  console.error('[API] Unhandled error:', error);
  return NextResponse.json(
    { error: error?.message || 'Internal server error' },
    { status: 500 }
  );
}

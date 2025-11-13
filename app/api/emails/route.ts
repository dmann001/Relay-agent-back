// Fetch emails from Gmail
import { NextRequest, NextResponse } from 'next/server';
import { gmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, maxResults = 50 } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    const emails = await gmail.fetchEmails(accessToken, maxResults);

    return NextResponse.json({ emails });
  } catch (error: any) {
    console.error('Error fetching emails:', error);

    // Check for Gmail API not enabled error
    if (error.message?.includes('Gmail API has not been used') || error.code === 403) {
      return NextResponse.json(
        {
          error: 'Gmail API not enabled',
          message: 'Please enable the Gmail API in your Google Cloud Console. Visit: https://console.developers.google.com/apis/api/gmail.googleapis.com/overview',
          code: 'GMAIL_API_DISABLED'
        },
        { status: 403 }
      );
    }

    // Check for invalid token
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        {
          error: 'Authentication expired',
          message: 'Please reconnect your Gmail account in Settings',
          code: 'AUTH_EXPIRED'
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}

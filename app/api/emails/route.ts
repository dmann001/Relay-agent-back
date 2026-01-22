// Fetch emails from Gmail
import { NextRequest, NextResponse } from 'next/server';
import { gmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken, expiryDate, maxResults = 50, pageToken, existingIds, quickSync, lastSyncTime, categoryFilter, mailbox } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    // Incremental sync mode - uses Gmail History API (most efficient)
    if (body.incrementalSync) {
      const result = await gmail.incrementalSync(
        accessToken,
        body.lastHistoryId,
        refreshToken,
        expiryDate
      );
      return NextResponse.json({
        emails: result.emails,
        newHistoryId: result.newHistoryId,
        deletedIds: result.deletedIds,
        auth: result.auth,
        syncType: 'incremental'
      });
    }

    // Quick sync mode - only fetch new emails since last sync
    if (quickSync) {
      const result = await gmail.quickSync(accessToken, lastSyncTime, categoryFilter, mailbox, refreshToken, expiryDate);
      return NextResponse.json({
        emails: result.emails,
        hasMore: result.hasMore,
        auth: result.auth,
        syncType: 'quick'
      });
    }

    // Full sync mode with optional existing IDs to skip
    const existingIdSet = existingIds ? new Set<string>(existingIds) : undefined;
    const result = await gmail.fetchEmails(accessToken, maxResults, pageToken, existingIdSet, categoryFilter, mailbox, refreshToken, expiryDate);

    return NextResponse.json({
      emails: result.emails,
      nextPageToken: result.nextPageToken,
      totalFetched: result.totalFetched,
      newCount: result.newCount,
      auth: result.auth,
      syncType: 'full'
    });
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

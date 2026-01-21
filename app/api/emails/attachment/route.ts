import { NextRequest, NextResponse } from 'next/server';
import { gmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken, expiryDate, messageId, attachmentId } = body;

    if (!accessToken || !messageId || !attachmentId) {
      return NextResponse.json(
        { error: 'Access token, messageId, and attachmentId are required' },
        { status: 400 }
      );
    }

    const result = await gmail.getAttachment(
      accessToken,
      messageId,
      attachmentId,
      refreshToken,
      expiryDate
    );

    return NextResponse.json({
      data: result.data,
      auth: result.auth,
    });
  } catch (error: any) {
    console.error('Attachment fetch error:', error);

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
      { error: error.message || 'Failed to fetch attachment' },
      { status: 500 }
    );
  }
}

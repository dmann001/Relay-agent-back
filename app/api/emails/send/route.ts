// Send email via Gmail API
import { NextRequest, NextResponse } from 'next/server';
import { gmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken, expiryDate, to, cc, subject, body: emailBody, threadId, inReplyToMessageId, attachments } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      );
    }

    if (!emailBody) {
      return NextResponse.json(
        { error: 'Email body is required' },
        { status: 400 }
      );
    }

    console.log(`[SendEmail] Sending to: ${to.join(', ')}, Subject: ${subject}`);

    const result = await gmail.sendEmail(
      accessToken,
      to,
      subject,
      emailBody,
      cc,
      threadId,
      inReplyToMessageId,
      attachments,
      refreshToken,
      expiryDate
    );

    console.log(`[SendEmail] Sent successfully, message ID: ${result.data.id}`);

    return NextResponse.json({
      success: true,
      messageId: result.data.id,
      threadId: result.data.threadId,
      auth: result.auth,
    });
  } catch (error: any) {
    console.error('Error sending email:', error);

    // Check for auth errors
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

    // Check for permission errors
    if (error.code === 403) {
      return NextResponse.json(
        {
          error: 'Permission denied',
          message: 'Gmail send permission not granted. Please reconnect your account.',
          code: 'PERMISSION_DENIED'
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}


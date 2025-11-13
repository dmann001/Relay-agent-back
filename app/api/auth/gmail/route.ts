// Gmail OAuth - Start flow
import { NextResponse } from 'next/server';
import { gmail } from '@/lib/gmail';

export async function GET() {
  try {
    const authUrl = gmail.getAuthUrl();
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

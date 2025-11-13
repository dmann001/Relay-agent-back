// Generate email draft using OpenAI
import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, email, instructions } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email context is required' },
        { status: 400 }
      );
    }

    const draft = await openai.generateDraft(apiKey, email, instructions);

    return NextResponse.json({ draft });
  } catch (error: any) {
    console.error('Error generating draft:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate draft' },
      { status: 500 }
    );
  }
}

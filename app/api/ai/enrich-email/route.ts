// Enrich email with AI summary and labels
import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, email } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate summary and labels in parallel
    const [summary, labels] = await Promise.all([
      openai.generateSummary(apiKey, email),
      openai.generateLabels(apiKey, email),
    ]);

    return NextResponse.json({ summary, labels });
  } catch (error: any) {
    console.error('Error enriching email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enrich email' },
      { status: 500 }
    );
  }
}

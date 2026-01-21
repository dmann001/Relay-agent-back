import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Email, EmailIntent } from '@/types';

const INTENT_SYSTEM_PROMPT = `You are an email intent classifier. Analyze the email and determine what action or response it requires from the recipient.

Classify the email into ONE of these intents:
- "decision": Email requires a decision, approval, or choice from the recipient
- "info_request": Email asks questions that need answers
- "meeting": Email is about scheduling, calendar coordination, or meeting requests
- "action_item": Email requires the recipient to complete a task or action
- "update": Email is purely informational, FYI, or status update (no action required)
- "relationship": Email is about networking, maintaining relationships, casual follow-ups, or social communication

Respond with ONLY the intent category (one word, lowercase).`;

export async function POST(request: NextRequest) {
  try {
    const { email, apiKey } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Prepare email content for analysis (truncate to save tokens)
    const subject = email.subject || 'No subject';
    const body = (email.bodyPlain || email.body || '')
      .replace(/<[^>]*>/g, '')
      .slice(0, 1500);
    const from = email.from?.name || email.from?.email || 'Unknown';

    const emailContent = `From: ${from}
Subject: ${subject}

${body}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: emailContent },
      ],
      max_tokens: 20,
      temperature: 0.1,
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase() as EmailIntent;

    // Validate the intent is one of our known values
    const validIntents: EmailIntent[] = ['decision', 'info_request', 'meeting', 'action_item', 'update', 'relationship'];
    const finalIntent: EmailIntent = validIntents.includes(intent) ? intent : 'unknown';

    return NextResponse.json({ intent: finalIntent });
  } catch (error: any) {
    console.error('Intent classification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to classify intent' },
      { status: 500 }
    );
  }
}

// Batch classification endpoint
export async function PUT(request: NextRequest) {
  try {
    const { emails, apiKey } = await request.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Emails array is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Process emails in parallel (with limit)
    const results: { emailId: string; intent: EmailIntent }[] = [];
    const batchSize = 5;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (email: Email) => {
          try {
            const subject = email.subject || 'No subject';
            const body = (email.bodyPlain || email.body || '')
              .replace(/<[^>]*>/g, '')
              .slice(0, 1000);
            const from = email.from?.name || email.from?.email || 'Unknown';

            const emailContent = `From: ${from}
Subject: ${subject}

${body}`;

            const response = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: INTENT_SYSTEM_PROMPT },
                { role: 'user', content: emailContent },
              ],
              max_tokens: 20,
              temperature: 0.1,
            });

            const intent = response.choices[0]?.message?.content?.trim().toLowerCase() as EmailIntent;
            const validIntents: EmailIntent[] = ['decision', 'info_request', 'meeting', 'action_item', 'update', 'relationship'];
            const finalIntent: EmailIntent = validIntents.includes(intent) ? intent : 'unknown';

            return { emailId: email.id, intent: finalIntent };
          } catch (error) {
            console.error(`Error classifying email ${email.id}:`, error);
            return { emailId: email.id, intent: 'unknown' as EmailIntent };
          }
        })
      );

      results.push(...batchResults);
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Batch intent classification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to classify intents' },
      { status: 500 }
    );
  }
}


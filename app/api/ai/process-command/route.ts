import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an AI email assistant for an email client.
Use the provided context (user profile, memory, inbox snapshot, and top emails) to answer precisely.
If information is missing, ask a clarifying question instead of guessing.
If a command requests an action you cannot execute, explain what the user can do in the app.`;

export async function POST(request: NextRequest) {
  try {
    const { command, emailCount, userContext, apiKey, context } = await request.json();

    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key is required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const memorySummary = context?.memorySummary || '';
    const recentCommands = context?.recentCommands || [];
    const inboxSnapshot = context?.inboxSnapshot;
    const topEmails = context?.topEmails || [];

    const prompt = `User context:
${userContext || 'None provided.'}

User memory summary:
${memorySummary || 'None recorded.'}

Recent commands:
${recentCommands.length > 0 ? recentCommands.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n') : 'None.'}

Inbox snapshot:
${inboxSnapshot ? JSON.stringify(inboxSnapshot, null, 2) : `Inbox size: ${typeof emailCount === 'number' ? emailCount : 'unknown'}`}

Top emails (most relevant):
${topEmails.length > 0 ? topEmails.map((email: any, i: number) => `${i + 1}. ${email.subject} | from ${email.from} | ${email.date} | intent: ${email.intent || 'unknown'} | priority: ${email.priority ?? 'n/a'} | snippet: ${email.snippet || ''}`).join('\n') : 'None.'}

User command: "${command}"
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.4,
    });

    const response = completion.choices[0]?.message?.content?.trim() || 'Sorry, I could not process that.';
    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Process command error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process command' },
      { status: 500 }
    );
  }
}

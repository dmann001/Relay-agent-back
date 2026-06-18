import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server/supabase-admin';
import { handleApiError } from '@/lib/server/api-utils';
import { AiRateLimitError, enforceAiRateLimit } from '@/lib/server/ai-rate-limit';
import { aiToolKeySchema, getAiModelSettings, isComputerUseRequested } from '@/lib/server/ai-model-settings';
import { AiConfigurationError, AiProviderError, AiRequestAbortedError } from '@/lib/server/openai';
import { runComputerUseAgent } from '@/lib/server/computer-use';

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1).max(80).optional(),
  instructions: z.string().trim().max(8000).optional(),
  startUrl: z.string().trim().max(2000).optional(),
  tools: z.array(aiToolKeySchema).max(8).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    enforceAiRateLimit(`computer-use:${userId}`, 8);
    const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
    }

    const modelSettings = await getAiModelSettings(userId);
    const selectedTools = parsed.data.tools?.length
      ? parsed.data.tools
      : (['computerUse'] as const);

    if (!isComputerUseRequested(modelSettings, [...selectedTools])) {
      return NextResponse.json({
        error: 'Computer use is disabled. Enable it in Settings → AI models.',
        code: 'COMPUTER_USE_DISABLED',
      }, { status: 403 });
    }

    const instructions = parsed.data.instructions || [
      'You are Relay computer use.',
      'Operate the browser carefully, avoid sensitive actions without explicit user approval,',
      'and summarize results clearly when finished.',
      parsed.data.startUrl ? `Start from ${parsed.data.startUrl} when navigation is needed.` : '',
    ].filter(Boolean).join('\n');

    const result = await runComputerUseAgent({
      instructions,
      task: parsed.data.prompt,
      model: parsed.data.model || modelSettings.defaultModel,
      abortSignal: request.signal,
    });

    return NextResponse.json({
      answer: result.answer,
      model: result.model,
      responseId: result.responseId,
      computerUse: {
        driver: result.driver,
        stepCount: result.stepCount,
        truncated: result.truncated,
        steps: result.steps,
      },
    });
  } catch (error) {
    if (error instanceof AiRequestAbortedError) {
      return NextResponse.json({ error: error.message, code: 'AI_ABORTED' }, { status: 499 });
    }
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: error.message, code: 'AI_RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    if (error instanceof AiConfigurationError) {
      return NextResponse.json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 503 });
    }
    if (error instanceof AiProviderError) {
      return NextResponse.json({ error: error.message, code: 'AI_PROVIDER_ERROR' }, { status: error.status });
    }
    return handleApiError(error);
  }
}

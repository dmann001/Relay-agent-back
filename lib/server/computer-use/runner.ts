import { AiConfigurationError, AiProviderError, AiRequestAbortedError } from '@/lib/server/openai';
import { computerUseToolDefinition, getComputerUseConfig, resolveComputerUseModel } from '@/lib/server/computer-use/config';
import { createComputerUseHarness } from '@/lib/server/computer-use/harness';
import { isValidPng } from '@/lib/server/computer-use/screenshot';
import type { ComputerCallItem, ComputerUseRunResult, ComputerUseStepLog } from '@/lib/server/computer-use/types';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function findComputerCall(output: unknown): ComputerCallItem | undefined {
  if (!Array.isArray(output)) return undefined;
  return output.find((item): item is ComputerCallItem =>
    Boolean(item && typeof item === 'object' && (item as ComputerCallItem).type === 'computer_call'),
  );
}

export function extractResponseText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of (payload.output as Array<Record<string, unknown>> | undefined) || []) {
    if (!Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

async function createComputerUseResponse(params: {
  apiKey: string;
  model: string;
  instructions?: string;
  input: string | Array<Record<string, unknown>>;
  previousResponseId?: string;
  abortSignal?: AbortSignal;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);
  const onAbort = () => controller.abort();
  if (params.abortSignal) {
    if (params.abortSignal.aborted) controller.abort();
    else params.abortSignal.addEventListener('abort', onAbort);
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        // Computer use loops rely on previous_response_id; stored responses are required.
        store: true,
        ...(params.instructions ? { instructions: params.instructions } : {}),
        tools: [computerUseToolDefinition()],
        input: params.input,
        ...(params.previousResponseId ? { previous_response_id: params.previousResponseId } : {}),
        truncation: 'auto',
        reasoning: { effort: 'medium' },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `AI provider request failed (${response.status})`;
      throw new AiProviderError(message, response.status === 429 ? 429 : 502);
    }
    return payload as Record<string, unknown>;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (params.abortSignal?.aborted) throw new AiRequestAbortedError();
      throw new AiProviderError('The computer use request timed out', 504);
    }
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError('Could not reach the AI provider');
  } finally {
    clearTimeout(timeout);
    if (params.abortSignal) params.abortSignal.removeEventListener('abort', onAbort);
  }
}

export async function runComputerUseAgent(params: {
  instructions: string;
  task: string;
  input?: string | Array<Record<string, unknown>>;
  model?: string;
  abortSignal?: AbortSignal;
}): Promise<ComputerUseRunResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiConfigurationError();

  const config = getComputerUseConfig();
  const model = resolveComputerUseModel(params.model);
  const harness = await createComputerUseHarness(config, { task: params.task });
  const steps: ComputerUseStepLog[] = [];
  let truncated = false;
  const startUrl = harness.startUrl;

  const taskPrompt = [
    params.task.trim(),
    'You control a live browser through the computer tool.',
    'Request a screenshot when you need to see the page, then click, type, scroll, or press keys to complete the task.',
    'If a cookie, consent, or location dialog appears, dismiss it before continuing.',
    'Do not give up after one page — keep using the computer tool until you can read the answer on screen.',
    'When finished, summarize what you found from the page content.',
  ].join('\n\n');

  try {
    let response = await createComputerUseResponse({
      apiKey,
      model,
      instructions: params.instructions,
      input: params.input ?? taskPrompt,
      abortSignal: params.abortSignal,
      timeoutMs: config.requestTimeoutMs,
    });

    for (let step = 0; step < config.maxSteps; step += 1) {
      const computerCall = findComputerCall(response.output);
      if (!computerCall) break;

      await harness.executeActions(computerCall.actions);
      steps.push({
        step: step + 1,
        callId: computerCall.call_id,
        actions: computerCall.actions,
        driver: harness.driver,
      });

      const screenshot = await harness.captureScreenshot();
      if (!isValidPng(screenshot)) {
        throw new AiProviderError('Computer use harness returned an invalid screenshot image');
      }

      const screenshotBase64 = screenshot.toString('base64');
      response = await createComputerUseResponse({
        apiKey,
        model,
        previousResponseId: String(response.id),
        input: [{
          type: 'computer_call_output',
          call_id: computerCall.call_id,
          output: {
            type: 'computer_screenshot',
            image_url: `data:image/png;base64,${screenshotBase64}`,
            detail: 'original',
          },
        }],
        abortSignal: params.abortSignal,
        timeoutMs: config.requestTimeoutMs,
      });

      if (step + 1 >= config.maxSteps) {
        truncated = Boolean(findComputerCall(response.output));
      }
    }

    const answer = extractResponseText(response);
    if (!answer) {
      throw new AiProviderError('Computer use finished without a final answer from the model');
    }

    const driverNote = harness.driver === 'simulated'
      ? '\n\n_Note: Relay ran this with synthetic viewport screenshots. Install Playwright (`pnpm add playwright` + `npx playwright install chromium`) or set `COMPUTER_USE_DRIVER=playwright` for a real browser._'
      : '';

    return {
      answer: `${answer}${driverNote}`,
      model,
      responseId: typeof response.id === 'string' ? response.id : undefined,
      driver: harness.driver,
      startUrl,
      steps,
      stepCount: steps.length,
      truncated,
    };
  } finally {
    await harness.dispose();
  }
}

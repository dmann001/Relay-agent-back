import { z } from 'zod';
import { DEFAULT_AI_MODEL } from '@/lib/server/ai-model-settings';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export class AiConfigurationError extends Error {
  constructor(message = 'Relay AI is not configured') {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

export class AiProviderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
  }
}

type JsonSchema = Record<string, unknown>;
export type OpenAiInputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export class AiRequestAbortedError extends Error {
  constructor(message = 'The AI request was cancelled') {
    super(message);
    this.name = 'AiRequestAbortedError';
  }
}

export function buildChatInput(params: {
  contextPrefix?: string;
  history?: ChatTurn[];
  prompt: string;
  inputParts?: OpenAiInputPart[];
}): string | Array<Record<string, unknown>> {
  const history = params.history || [];
  if (!history.length) {
    const text = params.contextPrefix
      ? `${params.contextPrefix}\n\nUSER:\n${params.prompt}`
      : params.prompt;
    if (params.inputParts?.length) {
      return [{
        role: 'user',
        content: [
          { type: 'input_text', text },
          ...params.inputParts,
        ],
      }];
    }
    return text;
  }

  const messages: Array<Record<string, unknown>> = [];
  history.forEach((turn, index) => {
    if (index === 0 && turn.role === 'user' && params.contextPrefix) {
      messages.push({
        role: 'user',
        content: `${params.contextPrefix}\n\nUSER:\n${turn.content}`,
        ...(index === 0 && params.inputParts?.length
          ? {
              content: [
                { type: 'input_text', text: `${params.contextPrefix}\n\nUSER:\n${turn.content}` },
                ...params.inputParts,
              ],
            }
          : {}),
      });
      return;
    }
    messages.push({ role: turn.role, content: turn.content });
  });

  if (history[history.length - 1]?.role !== 'user' || history[history.length - 1]?.content !== params.prompt) {
    messages.push({ role: 'user', content: params.prompt });
  }

  return messages;
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  throw new AiProviderError('The AI provider returned no text output');
}

export async function generateStructuredResponse<T>(params: {
  instructions: string;
  input: string | Array<Record<string, unknown>>;
  inputParts?: OpenAiInputPart[];
  history?: ChatTurn[];
  contextPrefix?: string;
  prompt?: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  validator: z.ZodType<T>;
  model?: string;
  tools?: Array<Record<string, unknown>>;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}): Promise<{ data: T; model: string; responseId?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiConfigurationError();

  const model = params.model || process.env.OPENAI_MODEL || DEFAULT_AI_MODEL;
  const input = Array.isArray(params.input)
    ? params.input
    : params.history?.length && params.prompt
      ? buildChatInput({
          contextPrefix: params.contextPrefix,
          history: params.history,
          prompt: params.prompt,
          inputParts: params.inputParts,
        })
      : params.inputParts?.length
        ? [{
            role: 'user',
            content: [
              { type: 'input_text', text: params.input as string },
              ...params.inputParts,
            ],
          }]
        : params.input;
  const hasTools = Boolean(params.tools?.length);
  const controller = new AbortController();
  const timeoutMs = hasTools ? 120_000 : 45_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (params.abortSignal) {
    if (params.abortSignal.aborted) controller.abort();
    else params.abortSignal.addEventListener('abort', onAbort);
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: params.instructions,
        input,
        ...(hasTools ? { tools: params.tools, tool_choice: 'auto' } : {}),
        max_output_tokens: params.maxOutputTokens ?? 1800,
        reasoning: { effort: hasTools ? 'medium' : 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: params.schemaName,
            strict: true,
            schema: params.jsonSchema,
          },
        },
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      if (params.abortSignal?.aborted) throw new AiRequestAbortedError();
      throw new AiProviderError('The AI request timed out', 504);
    }
    throw new AiProviderError('Could not reach the AI provider');
  } finally {
    clearTimeout(timeout);
    if (params.abortSignal) params.abortSignal.removeEventListener('abort', onAbort);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `AI provider request failed (${response.status})`;
    throw new AiProviderError(message, response.status === 429 ? 429 : 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractOutputText(payload));
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError('The AI provider returned invalid structured output');
  }

  const validated = params.validator.safeParse(parsed);
  if (!validated.success) {
    throw new AiProviderError('The AI provider returned an unexpected response shape');
  }

  return { data: validated.data, model, responseId: payload?.id };
}

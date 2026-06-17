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
  input: string;
  inputParts?: OpenAiInputPart[];
  schemaName: string;
  jsonSchema: JsonSchema;
  validator: z.ZodType<T>;
  model?: string;
  tools?: Array<Record<string, unknown>>;
  maxOutputTokens?: number;
}): Promise<{ data: T; model: string; responseId?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiConfigurationError();

  const model = params.model || process.env.OPENAI_MODEL || DEFAULT_AI_MODEL;
  const input = params.inputParts?.length
    ? [{
        role: 'user',
        content: [
          { type: 'input_text', text: params.input },
          ...params.inputParts,
        ],
      }]
    : params.input;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
        ...(params.tools?.length ? { tools: params.tools } : {}),
        max_output_tokens: params.maxOutputTokens ?? 1800,
        reasoning: { effort: 'low' },
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
    if (error?.name === 'AbortError') throw new AiProviderError('The AI request timed out', 504);
    throw new AiProviderError('Could not reach the AI provider');
  } finally {
    clearTimeout(timeout);
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

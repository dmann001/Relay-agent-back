import { AiConfigurationError, AiProviderError } from '@/lib/server/openai';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
export const RELAY_EMBEDDING_MODEL = 'text-embedding-3-small';

export async function createEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiConfigurationError();

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: RELAY_EMBEDDING_MODEL,
      input: input.slice(0, 8000),
    }),
  }).catch(() => null);

  if (!response) throw new AiProviderError('Could not reach the AI provider');

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiProviderError(payload?.error?.message || `Embedding request failed (${response.status})`, response.status);
  }

  const embedding = payload?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new AiProviderError('The AI provider returned no embedding');
  return embedding.map(Number);
}

export async function createEmbeddingOrNull(input: string): Promise<number[] | null> {
  if (!input.trim() || !process.env.OPENAI_API_KEY) return null;
  try {
    return await createEmbedding(input);
  } catch (error) {
    console.error('[Personalization] Embedding skipped:', error);
    return null;
  }
}

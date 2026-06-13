type RateEntry = { count: number; resetAt: number };

const buckets = new Map<string, RateEntry>();

export class AiRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Too many AI requests. Please wait and try again.');
    this.name = 'AiRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function enforceAiRateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new AiRateLimitError(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  }
  current.count += 1;
}

export function resetAiRateLimitsForTests(): void {
  buckets.clear();
}

import { AiRateLimitError, enforceAiRateLimit, resetAiRateLimitsForTests } from "@/lib/server/ai-rate-limit"

describe("AI rate limiting", () => {
  beforeEach(() => resetAiRateLimitsForTests())

  it("allows requests within the window and rejects excess requests", () => {
    enforceAiRateLimit("user", 2, 60_000)
    enforceAiRateLimit("user", 2, 60_000)
    expect(() => enforceAiRateLimit("user", 2, 60_000)).toThrow(AiRateLimitError)
  })

  it("keeps users and features in separate buckets", () => {
    enforceAiRateLimit("thread:user-1", 1)
    expect(() => enforceAiRateLimit("thread:user-2", 1)).not.toThrow()
    expect(() => enforceAiRateLimit("brief:user-1", 1)).not.toThrow()
  })
})

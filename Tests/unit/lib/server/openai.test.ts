import { z } from "zod"
import { AiConfigurationError, AiProviderError, generateStructuredResponse } from "@/lib/server/openai"

const originalKey = process.env.OPENAI_API_KEY
const originalModel = process.env.OPENAI_MODEL

afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalKey
  if (originalModel === undefined) delete process.env.OPENAI_MODEL
  else process.env.OPENAI_MODEL = originalModel
  jest.restoreAllMocks()
})

describe("generateStructuredResponse", () => {
  it("rejects requests when the server key is not configured", async () => {
    delete process.env.OPENAI_API_KEY
    await expect(generateStructuredResponse({
      instructions: "test",
      input: "test",
      schemaName: "test",
      jsonSchema: { type: "object" },
      validator: z.object({ value: z.string() }),
    })).rejects.toBeInstanceOf(AiConfigurationError)
  })

  it("uses the Responses API with strict structured output and validates the result", async () => {
    process.env.OPENAI_API_KEY = "server-secret"
    process.env.OPENAI_MODEL = "gpt-test"
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      id: "response-1",
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ value: "safe" }) }] }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))

    const result = await generateStructuredResponse({
      instructions: "system instructions",
      input: "email context",
      schemaName: "test_schema",
      jsonSchema: { type: "object", additionalProperties: false, required: ["value"], properties: { value: { type: "string" } } },
      validator: z.object({ value: z.string() }),
    })

    expect(result).toEqual({ data: { value: "safe" }, model: "gpt-test", responseId: "response-1" })
    const [, request] = fetchMock.mock.calls[0]
    const body = JSON.parse(String(request?.body))
    expect(request?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer server-secret" }))
    expect(body.store).toBe(false)
    expect(body.text.format).toEqual(expect.objectContaining({ type: "json_schema", strict: true, name: "test_schema" }))
    expect(body.input).toBe("email context")
  })

  it("rejects malformed provider output", async () => {
    process.env.OPENAI_API_KEY = "server-secret"
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ output_text: "not-json" }), { status: 200 }))
    await expect(generateStructuredResponse({
      instructions: "test",
      input: "test",
      schemaName: "test",
      jsonSchema: { type: "object" },
      validator: z.object({ value: z.string() }),
    })).rejects.toBeInstanceOf(AiProviderError)
  })
})

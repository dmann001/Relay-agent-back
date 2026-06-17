/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AiInboxChat } from "@/components/ai-inbox-chat"
import { emailApi } from "@/lib/email-api"

jest.mock("@/lib/email-api", () => ({
  EmailApiError: class EmailApiError extends Error { code?: string },
  emailApi: {
    getAiModelSettings: jest.fn(),
    getAiChatSession: jest.fn(),
    runComposeAi: jest.fn(),
    runThreadAi: jest.fn(),
  },
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

const api = emailApi as jest.Mocked<typeof emailApi>

describe("AiInboxChat", () => {
  beforeEach(() => {
    api.getAiModelSettings.mockResolvedValue({
      settings: {
        defaultModel: "gpt-test",
        tools: {
          webSearch: true,
          fileSearch: false,
          codeInterpreter: false,
          imageGeneration: false,
          computerUse: false,
          mcpConnectors: false,
          toolSearch: false,
        },
      },
      models: [{ id: "gpt-test", label: "GPT Test", description: "Test model" }],
    })
    api.getAiChatSession.mockResolvedValue({
      session: {
        id: "session-1",
        accountId: null,
        messageId: null,
        title: "Old chat",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        preview: "Hello",
        messages: [{ id: "m1", role: "user", content: "Hello", model: null, tools: [], responseId: null, createdAt: "2026-01-01T00:00:00.000Z" }],
      },
    })
    api.runComposeAi.mockReset()
    api.runThreadAi.mockReset()
  })

  it("uses thread AI when a message is open", async () => {
    api.runThreadAi.mockResolvedValue({
      result: { kind: "answer", answer: "The sender needs a reply.", evidence: [] },
      context: { accountId: "account-1", accountEmail: "me@example.com", messageId: "message-1", subject: "Plan" },
      model: "gpt-test",
      sessionId: "session-1",
    })

    render(<AiInboxChat accountId="account-1" messageId="message-1" subject="Plan" onClose={jest.fn()} />)
    await screen.findByPlaceholderText("Ask about this email...")

    fireEvent.change(screen.getByPlaceholderText("Ask about this email..."), { target: { value: "What is needed?" } })
    fireEvent.keyDown(screen.getByPlaceholderText("Ask about this email..."), { key: "Enter" })

    await waitFor(() => expect(api.runThreadAi).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "message-1",
      accountId: "account-1",
      action: "ask",
      prompt: "What is needed?",
      model: "gpt-test",
      tools: [],
      history: [],
      createSession: true,
    })))
    expect(await screen.findByText("The sender needs a reply.")).toBeInTheDocument()
  })

  it("keeps Shift+Enter as a newline in the chat box", async () => {
    render(<AiInboxChat accountId="account-1" messageId="message-1" subject="Plan" onClose={jest.fn()} />)
    await screen.findByPlaceholderText("Ask about this email...")

    fireEvent.change(screen.getByPlaceholderText("Ask about this email..."), { target: { value: "Line one" } })
    fireEvent.keyDown(screen.getByPlaceholderText("Ask about this email..."), { key: "Enter", shiftKey: true })

    expect(api.runThreadAi).not.toHaveBeenCalled()
  })

  it("uses compose AI when no email is selected", async () => {
    api.runComposeAi.mockResolvedValue({
      result: { answer: "I can help draft that.", subject: "", body: "" },
      context: { accountId: "account-1", accountEmail: "me@example.com" },
      model: "gpt-test",
    })

    render(<AiInboxChat accountId="account-1" onClose={jest.fn()} />)
    await screen.findByPlaceholderText("Ask Relay...")

    fireEvent.change(screen.getByPlaceholderText("Ask Relay..."), { target: { value: "Draft a follow-up" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => expect(api.runComposeAi).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "account-1",
      prompt: "Draft a follow-up",
      model: "gpt-test",
      tools: [],
      history: [],
      createSession: true,
    })))
    expect(await screen.findByText("I can help draft that.")).toBeInTheDocument()
  })

  it("only sends web search when selected from the plus menu", async () => {
    api.runThreadAi.mockResolvedValue({
      result: { kind: "answer", answer: "I checked the web.", evidence: [] },
      context: { accountId: "account-1", accountEmail: "me@example.com", messageId: "message-1", subject: "Plan" },
      model: "gpt-test",
    })

    render(<AiInboxChat accountId="account-1" messageId="message-1" subject="Plan" onClose={jest.fn()} />)
    await screen.findByPlaceholderText("Ask about this email...")

    fireEvent.click(await screen.findByRole("button", { name: "Add AI tool" }))
    fireEvent.click(screen.getByText("Web search"))
    expect(screen.getByRole("button", { name: "Remove Web search" })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("Ask about this email..."), { target: { value: "Look this up" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => expect(api.runThreadAi).toHaveBeenCalledWith(expect.objectContaining({
      tools: ["webSearch"],
    })))
  })

  it("loads an existing chat session", async () => {
    render(<AiInboxChat accountId="account-1" sessionId="session-1" onClose={jest.fn()} />)
    expect(await screen.findByText("Hello")).toBeInTheDocument()
    expect(api.getAiChatSession).toHaveBeenCalledWith("session-1")
  })

  it("shows stop while loading", async () => {
    let resolve!: (value: any) => void
    api.runComposeAi.mockReturnValue(new Promise((res) => { resolve = res }))
    render(<AiInboxChat accountId="account-1" onClose={jest.fn()} />)
    await screen.findByPlaceholderText("Ask Relay...")
    fireEvent.change(screen.getByPlaceholderText("Ask Relay..."), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(await screen.findByRole("button", { name: "Stop" })).toBeInTheDocument()
    resolve({
      result: { answer: "Done", subject: "", body: "" },
      context: { accountId: "account-1", accountEmail: "me@example.com" },
      model: "gpt-test",
    })
    expect(await screen.findByText("Done")).toBeInTheDocument()
  })
})

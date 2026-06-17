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
    runComposeAi: jest.fn(),
    runThreadAi: jest.fn(),
  },
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
    api.runComposeAi.mockReset()
    api.runThreadAi.mockReset()
  })

  it("uses thread AI when a message is open", async () => {
    api.runThreadAi.mockResolvedValue({
      result: { kind: "answer", answer: "The sender needs a reply.", evidence: [] },
      context: { accountId: "account-1", accountEmail: "me@example.com", messageId: "message-1", subject: "Plan" },
      model: "gpt-test",
    })

    render(<AiInboxChat accountId="account-1" messageId="message-1" subject="Plan" onClose={jest.fn()} />)
    await screen.findByRole("combobox", { name: "OpenAI model" })

    fireEvent.change(screen.getByPlaceholderText("Ask about this email..."), { target: { value: "What is needed?" } })
    fireEvent.keyDown(screen.getByPlaceholderText("Ask about this email..."), { key: "Enter" })

    await waitFor(() => expect(api.runThreadAi).toHaveBeenCalledWith({
      messageId: "message-1",
      accountId: "account-1",
      action: "ask",
      prompt: "What is needed?",
      model: "gpt-test",
      tools: [],
    }))
    expect(await screen.findByText("The sender needs a reply.")).toBeInTheDocument()
  })

  it("keeps Shift+Enter as a newline in the chat box", async () => {
    render(<AiInboxChat accountId="account-1" messageId="message-1" subject="Plan" onClose={jest.fn()} />)
    await screen.findByRole("combobox", { name: "OpenAI model" })

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
    await screen.findByRole("combobox", { name: "OpenAI model" })

    fireEvent.change(screen.getByPlaceholderText("Ask Relay..."), { target: { value: "Draft a follow-up" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => expect(api.runComposeAi).toHaveBeenCalledWith({
      accountId: "account-1",
      prompt: "Draft a follow-up",
      model: "gpt-test",
      tools: [],
    }))
    expect(await screen.findByText("I can help draft that.")).toBeInTheDocument()
  })

  it("only sends web search when selected from the plus menu", async () => {
    api.runThreadAi.mockResolvedValue({
      result: { kind: "answer", answer: "I checked the web.", evidence: [] },
      context: { accountId: "account-1", accountEmail: "me@example.com", messageId: "message-1", subject: "Plan" },
      model: "gpt-test",
    })

    render(<AiInboxChat accountId="account-1" messageId="message-1" subject="Plan" onClose={jest.fn()} />)
    await screen.findByRole("combobox", { name: "OpenAI model" })

    fireEvent.click(await screen.findByRole("button", { name: "Add AI tool" }))
    fireEvent.click(screen.getByText("Web search"))
    expect(screen.getByRole("button", { name: "Remove Web search" })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText("Ask about this email..."), { target: { value: "Look this up" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    await waitFor(() => expect(api.runThreadAi).toHaveBeenCalledWith(expect.objectContaining({
      tools: ["webSearch"],
    })))
  })
})

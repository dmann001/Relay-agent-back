/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AiThreadAssistant } from "@/components/ai-thread-assistant"
import { emailApi } from "@/lib/email-api"

jest.mock("@/lib/email-api", () => ({
  EmailApiError: class EmailApiError extends Error { code?: string },
  emailApi: { runThreadAi: jest.fn() },
}))

const runThreadAi = emailApi.runThreadAi as jest.Mock

describe("AiThreadAssistant", () => {
  beforeEach(() => runThreadAi.mockReset())

  it("shows account context and inserts an AI draft without sending", async () => {
    runThreadAi.mockResolvedValue({
      result: { kind: "draft", draft: "Tuesday works for me.", rationale: "Direct confirmation.", assumptions: [] },
      context: { accountId: "a1", accountEmail: "work@example.com", messageId: "m1", subject: "Meeting" },
      model: "gpt-test",
    })
    const onInsertDraft = jest.fn()

    render(<AiThreadAssistant messageId="m1" subject="Meeting" open initialAction="draft" onOpenChange={jest.fn()} onInsertDraft={onInsertDraft} />)

    expect(await screen.findByText("Tuesday works for me.")).toBeInTheDocument()
    expect(screen.getByText("work@example.com")).toBeInTheDocument()
    expect(screen.getByText("Relay never sends AI-generated drafts automatically.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Insert into reply" }))
    expect(onInsertDraft).toHaveBeenCalledWith("Tuesday works for me.")
  })

  it("requires a question before asking Relay", async () => {
    runThreadAi.mockResolvedValue({
      result: { kind: "answer", answer: "The date is Tuesday.", evidence: ["Tuesday works"] },
      context: { accountId: "a1", accountEmail: "work@example.com", messageId: "m1", subject: "Meeting" },
      model: "gpt-test",
    })

    render(<AiThreadAssistant messageId="m1" subject="Meeting" open onOpenChange={jest.fn()} onInsertDraft={jest.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Ask Relay" }))
    expect(screen.getByRole("button", { name: "Submit question" })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText("Ask about this email…"), { target: { value: "When is it?" } })
    fireEvent.click(screen.getByRole("button", { name: "Submit question" }))
    await waitFor(() => expect(runThreadAi).toHaveBeenCalledWith({ messageId: "m1", action: "ask", prompt: "When is it?" }))
    expect(await screen.findByText("The date is Tuesday.")).toBeInTheDocument()
  })
})

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

    expect(await screen.findAllByText("Tuesday works for me.")).toHaveLength(2)
    expect(screen.getAllByText("work@example.com")[0]).toBeInTheDocument()
    expect(screen.getAllByText("Relay never sends AI-generated drafts automatically.")[0]).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Insert into reply" })[0])
    expect(onInsertDraft).toHaveBeenCalledWith("Tuesday works for me.")
  })

  it("requires a question before asking Relay", async () => {
    runThreadAi.mockResolvedValue({
      result: { kind: "answer", answer: "The date is Tuesday.", evidence: ["Tuesday works"] },
      context: { accountId: "a1", accountEmail: "work@example.com", messageId: "m1", subject: "Meeting" },
      model: "gpt-test",
    })

    render(<AiThreadAssistant messageId="m1" subject="Meeting" open onOpenChange={jest.fn()} onInsertDraft={jest.fn()} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Ask Relay" })[0])
    expect(screen.getAllByRole("button", { name: "Submit question" })[0]).toBeDisabled()
    fireEvent.change(screen.getAllByPlaceholderText("Ask about this email…")[0], { target: { value: "When is it?" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Submit question" })[0])
    await waitFor(() => expect(runThreadAi).toHaveBeenCalledWith({ messageId: "m1", action: "ask", prompt: "When is it?" }))
    expect(await screen.findAllByText("The date is Tuesday.")).toHaveLength(2)
  })
})

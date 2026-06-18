/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ComposeDialog } from "@/components/compose-dialog"
import { emailApi } from "@/lib/email-api"

jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock("@/lib/email-api", () => ({
  emailApi: {
    listAccounts: jest.fn(),
    runComposeAi: jest.fn(),
    saveDraft: jest.fn(),
    sendEmail: jest.fn(),
  },
}))

const api = emailApi as jest.Mocked<typeof emailApi>

describe("ComposeDialog account selection", () => {
  beforeEach(() => {
    api.listAccounts.mockResolvedValue([
      { id: "work", email: "work@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
      { id: "personal", email: "me@gmail.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
    ])
    api.runComposeAi.mockResolvedValue({
      result: {
        answer: "Here is a cleaner draft.",
        to: ["ada@example.com"],
        cc: [],
        subject: "Updated project plan",
        body: "Hi Ada,\n\nHere is the updated plan.",
      },
      context: { accountId: "work", accountEmail: "work@example.com" },
      model: "gpt-test",
    })
    api.sendEmail.mockResolvedValue({ messageId: "sent" })
    api.saveDraft.mockResolvedValue({ draftId: "draft", gmailDraftId: "gmail-draft" })
  })

  afterEach(() => jest.clearAllMocks())

  it("uses the explicitly selected From account when sending", async () => {
    render(<ComposeDialog open onOpenChange={jest.fn()} defaultAccountId="personal" />)
    await waitFor(() => expect(screen.getByLabelText("From")).toHaveValue("personal"))
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "friend@example.com" } })
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Hello" } })
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hi there" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(api.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ accountId: "personal" })))
  })

  it("locks replies to the account that received the conversation", async () => {
    render(<ComposeDialog open onOpenChange={jest.fn()} replyTo={{ to: "sender@example.com", subject: "Hello", accountId: "work" }} />)
    const from = await screen.findByLabelText("From")
    await waitFor(() => expect(from).toHaveValue("work"))
    expect(from).toBeDisabled()
    expect(screen.getByText("Replies use the account that received this conversation.")).toBeInTheDocument()
  })

  it("opens Relay AI and inserts a generated draft", async () => {
    render(<ComposeDialog open onOpenChange={jest.fn()} defaultAccountId="work" />)
    await waitFor(() => expect(screen.getByLabelText("From")).toHaveValue("work"))

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "ada@example.com" } })
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Plan" } })
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "rough draft" } })
    fireEvent.click(screen.getByRole("button", { name: "AI" }))
    fireEvent.change(screen.getByPlaceholderText("Ask Relay to draft, polish, shorten, or make this warmer..."), {
      target: { value: "Make it concise" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }))

    await waitFor(() => expect(api.runComposeAi).toHaveBeenCalledWith({
      accountId: "work",
      prompt: "Make it concise",
      to: "ada@example.com",
      cc: "",
      subject: "Plan",
      body: "rough draft",
    }))

    fireEvent.click(await screen.findByRole("button", { name: "Insert draft" }))
    expect(screen.getByLabelText("Subject")).toHaveValue("Updated project plan")
    expect(screen.getByLabelText("Message")).toHaveValue("Hi Ada,\n\nHere is the updated plan.")
  })
})

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
})

/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ArchivesList } from "@/components/archives-list"
import { DraftsList } from "@/components/drafts-list"
import { SentList } from "@/components/sent-list"
import { TrashList } from "@/components/trash-list"
import { emailApi } from "@/lib/email-api"
import type { Email } from "@/types"

jest.mock("@/components/thread-view", () => ({
  ThreadView: ({ threadId }: { threadId: string }) => <div>Reading {threadId}</div>,
}))

jest.mock("@/components/compose-dialog", () => ({
  ComposeDialog: ({ draft }: { draft?: { body?: string } }) => (
    <div data-testid="compose-draft-body">{draft?.body || ""}</div>
  ),
}))

jest.mock("@/components/resize-handle", () => ({
  ResizeHandle: ({ label }: { label: string }) => <button type="button">{label}</button>,
}))

jest.mock("@/hooks/use-resizable-panel", () => ({
  useResizablePanel: () => ({
    width: 380,
    isResizing: false,
    startResize: jest.fn(),
  }),
}))

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

jest.mock("@/lib/email-api", () => ({
  emailApi: {
    deleteDraft: jest.fn(),
    listAccounts: jest.fn(),
    listDrafts: jest.fn(),
    listEmails: jest.fn(),
    modifyEmail: jest.fn(),
    sync: jest.fn(),
  },
}))

const api = emailApi as jest.Mocked<typeof emailApi>

const message = (id: string, subject: string): Email => ({
  id,
  threadId: `thread-${id}`,
  from: { name: "Ada Lovelace", email: "ada@example.com" },
  to: [{ name: "Grace Hopper", email: "grace@example.com" }],
  subject,
  body: "",
  bodyPlain: "A short preview",
  snippet: "A short preview",
  date: "2026-06-13T09:30:00.000Z",
  read: true,
  labels: [],
  provider: "gmail",
  accountId: "account-1",
  accountEmail: "me@example.com",
})

describe("mailbox split views", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    api.listAccounts.mockResolvedValue([
      { id: "account-1", email: "me@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
    ])
    api.sync.mockResolvedValue({ results: [] })
    api.modifyEmail.mockResolvedValue(undefined)
    api.deleteDraft.mockResolvedValue(undefined)
  })

  it("opens sent mail in an adjustable reading pane", async () => {
    api.listEmails.mockResolvedValue({ emails: [message("sent-1", "Sent plan")], total: 1 })

    render(<SentList />)

    await screen.findByText("Sent plan")
    expect(screen.getByRole("button", { name: "Resize sent list" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Sent plan"))
    expect(screen.getByText("Reading sent-1")).toBeInTheDocument()
  })

  it("opens archived mail in an adjustable reading pane", async () => {
    api.listEmails.mockResolvedValue({ emails: [message("archive-1", "Archived plan")], total: 1 })

    render(<ArchivesList />)

    await screen.findByText("Archived plan")
    expect(screen.getByRole("button", { name: "Resize archives list" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Archived plan"))
    expect(screen.getByText("Reading archive-1")).toBeInTheDocument()
  })

  it("opens trash mail in an adjustable reading pane", async () => {
    api.listEmails.mockResolvedValue({ emails: [message("trash-1", "Deleted plan")], total: 1 })

    render(<TrashList />)

    await screen.findByText("Deleted plan")
    expect(screen.getByRole("button", { name: "Resize trash list" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Deleted plan"))
    expect(screen.getByText("Reading trash-1")).toBeInTheDocument()
  })

  it("previews drafts without flattening multiline body structure", async () => {
    api.listDrafts.mockResolvedValue([
      {
        id: "draft-1",
        providerDraftId: "gmail-draft-1",
        gmailDraftId: "gmail-draft-1",
        accountId: "account-1",
        to: ["ada@example.com"],
        cc: [],
        subject: "Draft plan",
        snippet: "Hi Ada, Please review. Regards, Grace",
        body: "Hi Ada,\n\nPlease review the plan.\n\nRegards,\nGrace",
        status: "saved",
        lastEdited: "2026-06-13T09:30:00.000Z",
        provider: "gmail",
      },
    ])

    render(<DraftsList />)

    await screen.findByText("Draft plan")
    expect(screen.getByRole("button", { name: "Resize drafts list" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Draft plan"))
    expect(screen.getByText(/Hi Ada,\s+Please review the plan.\s+Regards,\s+Grace/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    await waitFor(() =>
      expect(screen.getByTestId("compose-draft-body").textContent).toBe(
        "Hi Ada,\n\nPlease review the plan.\n\nRegards,\nGrace",
      ),
    )
  })
})

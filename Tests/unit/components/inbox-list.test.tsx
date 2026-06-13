/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { InboxList } from "@/components/inbox-list"
import { emailApi } from "@/lib/email-api"
import type { Email } from "@/types"

const replace = jest.fn()
let params = new URLSearchParams()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
}))

jest.mock("@/components/compose-dialog", () => ({
  ComposeDialog: () => null,
}))

jest.mock("@/components/thread-view", () => ({
  ThreadView: ({ threadId }: { threadId: string }) => <div>Reading {threadId}</div>,
}))

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

jest.mock("@/lib/email-api", () => ({
  EmailApiError: class EmailApiError extends Error {},
  emailApi: {
    listAccounts: jest.fn(),
    listEmails: jest.fn(),
    sync: jest.fn(),
    modifyEmail: jest.fn(),
  },
}))

const mockedApi = emailApi as jest.Mocked<typeof emailApi>

const messages: Email[] = [
  {
    id: "message-1",
    threadId: "thread-1",
    from: { name: "Ada Lovelace", email: "ada@example.com" },
    to: [],
    subject: "Project update",
    body: "",
    bodyPlain: "The release is ready for review.",
    snippet: "The release is ready for review.",
    date: "2026-06-13T09:30:00.000Z",
    read: false,
    labels: [],
    provider: "gmail",
    gmailCategory: "primary",
  },
  {
    id: "message-2",
    threadId: "thread-2",
    from: { name: "Grace Hopper", email: "grace@example.com" },
    to: [],
    subject: "Compiler notes",
    body: "",
    bodyPlain: "A short status note.",
    snippet: "A short status note.",
    date: "2026-06-12T09:30:00.000Z",
    read: true,
    labels: [],
    provider: "gmail",
    gmailCategory: "primary",
  },
]

class IntersectionObserverMock {
  observe = jest.fn()
  disconnect = jest.fn()
  unobserve = jest.fn()
}

beforeAll(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverMock,
  })
  Object.defineProperty(global, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverMock,
  })
})

beforeEach(() => {
  params = new URLSearchParams()
  replace.mockReset()
  mockedApi.listAccounts.mockResolvedValue([{ id: "account-1", email: "me@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null }])
  mockedApi.listEmails.mockResolvedValue({ emails: messages, total: messages.length, hasMore: false })
  mockedApi.sync.mockResolvedValue({ results: [] })
  mockedApi.modifyEmail.mockResolvedValue(undefined)
})

afterEach(() => jest.clearAllMocks())

describe("InboxList", () => {
  it("renders dense rows and opens a message in the URL-backed reading pane", async () => {
    render(<InboxList />)

    expect(await screen.findByText("Project update")).toBeInTheDocument()
    expect(screen.getByText("Compiler notes")).toBeInTheDocument()
    expect(screen.getByText("2 of 2 loaded")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Project update"))
    expect(replace).toHaveBeenCalledWith("/inbox?message=message-1", { scroll: false })
  })

  it("changes category quick views and closes any selected message", async () => {
    params = new URLSearchParams("message=message-1")
    render(<InboxList />)
    await screen.findByText("Reading message-1")

    fireEvent.click(screen.getByRole("button", { name: "Updates" }))
    expect(replace).toHaveBeenCalledWith("/inbox?category=updates", { scroll: false })
  })

  it("supports selecting visible mail and applying a bulk read action", async () => {
    render(<InboxList />)
    await screen.findByText("Project update")

    fireEvent.click(screen.getByRole("checkbox", { name: "Select visible emails" }))
    expect(screen.getByText("2 selected")).toBeInTheDocument()

    fireEvent.click(screen.getByTitle("Mark selected as read"))
    await waitFor(() => expect(mockedApi.modifyEmail).toHaveBeenCalledTimes(2))
    expect(mockedApi.modifyEmail).toHaveBeenCalledWith("message-1", "markRead")
    expect(mockedApi.modifyEmail).toHaveBeenCalledWith("message-2", "markRead")
  })

  it("supports j/k navigation and Escape without hijacking text inputs", async () => {
    render(<InboxList />)
    await screen.findByText("Project update")

    fireEvent.keyDown(window, { key: "j" })
    expect(replace).toHaveBeenCalledWith("/inbox?message=message-1", { scroll: false })

    replace.mockClear()
    fireEvent.keyDown(screen.getByPlaceholderText("Search emails..."), { key: "j" })
    expect(replace).not.toHaveBeenCalled()
  })

  it("searches within loaded mail and explains the current scope", async () => {
    render(<InboxList />)
    await screen.findByText("Project update")

    fireEvent.change(screen.getByPlaceholderText("Search emails..."), { target: { value: "compiler" } })
    await waitFor(() => expect(screen.queryByText("Project update")).not.toBeInTheDocument())
    expect(screen.getByText("Compiler notes")).toBeInTheDocument()
    expect(screen.getByText("1 loaded match")).toBeInTheDocument()
  })
})

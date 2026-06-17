/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppSidebar } from "@/components/app-sidebar"
import { emailApi } from "@/lib/email-api"
import { useAuth } from "@/components/auth-provider"

let pathname = "/inbox"

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

jest.mock("@/components/auth-provider", () => ({
  useAuth: jest.fn(),
}))

jest.mock("@/components/compose-dialog", () => ({
  ComposeDialog: ({ open }: { open: boolean }) => (
    <div data-testid="sidebar-compose-state">{open ? "compose open" : "compose closed"}</div>
  ),
}))

jest.mock("@/components/theme-toggle", () => ({
  ThemeToggle: ({ collapsed }: { collapsed?: boolean }) => (
    <button type="button">Theme {collapsed ? "collapsed" : "expanded"}</button>
  ),
}))

jest.mock("@/components/resize-handle", () => ({
  ResizeHandle: ({ label }: { label: string }) => <button type="button">{label}</button>,
}))

jest.mock("@/hooks/use-resizable-panel", () => ({
  useResizablePanel: () => ({
    width: 240,
    isResizing: false,
    startResize: jest.fn(),
  }),
}))

jest.mock("@/lib/email-api", () => ({
  emailApi: {
    getCounts: jest.fn(),
    listAccounts: jest.fn(),
    listAgentActivity: jest.fn(),
    listCommitments: jest.fn(),
  },
}))

const api = emailApi as jest.Mocked<typeof emailApi>
const mockedUseAuth = useAuth as jest.Mock

describe("AppSidebar", () => {
  const signOut = jest.fn()

  beforeEach(() => {
    pathname = "/inbox"
    window.localStorage.clear()
    signOut.mockReset()
    mockedUseAuth.mockReturnValue({
      user: { email: "owner@example.com", user_metadata: { full_name: "D. Relay" } },
      signOut,
    })
    api.getCounts.mockResolvedValue({
      counts: {
        inboxUnread: 7,
        drafts: 2,
        archives: 1,
        sent: 3,
        trash: 4,
      },
    })
    api.listAccounts.mockResolvedValue([
      {
        id: "work",
        email: "work@example.com",
        provider: "gmail",
        connectedAt: "",
        lastSyncedAt: null,
        syncStatus: "healthy",
        unreadCount: 12,
      },
      {
        id: "personal",
        email: "me@example.com",
        provider: "outlook",
        connectedAt: "",
        lastSyncedAt: null,
        syncStatus: "error",
        unreadCount: 0,
      },
    ])
    api.listAgentActivity.mockResolvedValue({ activities: [], needsAttention: 5 })
    api.listCommitments.mockResolvedValue({ commitments: [], needsAttention: 6 })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders counts, connected accounts, and core navigation", async () => {
    render(<AppSidebar />)

    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("href", "/inbox")
    expect(screen.getByRole("link", { name: /Sent/ })).toHaveAttribute("href", "/sent")
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings")

    expect(await screen.findByText("work@example.com")).toBeInTheDocument()
    expect(screen.getByText("12 unread")).toBeInTheDocument()
    expect(screen.getByText("me@example.com")).toBeInTheDocument()
    expect(screen.getByText("Fix")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("opens compose and signs out from the user action", async () => {
    render(<AppSidebar />)

    await waitFor(() => expect(api.getCounts).toHaveBeenCalled())
    expect(screen.getByTestId("sidebar-compose-state")).toHaveTextContent("compose closed")
    fireEvent.click(screen.getByRole("button", { name: /Compose/ }))
    expect(screen.getByTestId("sidebar-compose-state")).toHaveTextContent("compose open")

    fireEvent.click(screen.getByRole("button", { name: "D. Relay" }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("persists collapsed sidebar state", async () => {
    render(<AppSidebar />)

    await waitFor(() => expect(api.getCounts).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(window.localStorage.getItem("relay-sidebar-collapsed")).toBe("true")
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(window.localStorage.getItem("relay-sidebar-collapsed")).toBe("false")
  })
})

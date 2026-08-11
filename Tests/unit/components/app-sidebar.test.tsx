/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppSidebar } from "@/components/app-sidebar"
import { emailApi } from "@/lib/email-api"
import { useAuth } from "@/components/auth-provider"

let pathname = "/inbox"
let sidebarResizing = false

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }: any) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
    >
      {children}
    </a>
  ),
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
    isResizing: sidebarResizing,
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
    sidebarResizing = false
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

  it("renders counts, connected accounts, workspace menu, and core navigation", async () => {
    render(<AppSidebar />)

    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("href", "/inbox")
    expect(screen.getByRole("link", { name: /Sent/ })).toHaveAttribute("href", "/sent")
    expect(screen.getByRole("button", { name: "Open workspace menu" })).toBeInTheDocument()

    expect(await screen.findByText("Gmail")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Gmail/ })).toHaveAttribute("title", "work@example.com")
    expect(screen.getByText("12 unread")).toBeInTheDocument()
    expect(screen.getByText("Outlook")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Outlook/ })).toHaveAttribute("title", "me@example.com")
    expect(screen.getByText("Fix")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("opens compose from the single sidebar action and signs out from the workspace menu", async () => {
    render(<AppSidebar />)

    await waitFor(() => expect(api.getCounts).toHaveBeenCalled())
    expect(screen.getByTestId("sidebar-compose-state")).toHaveTextContent("compose closed")
    fireEvent.click(screen.getByRole("button", { name: "New email" }))
    expect(screen.getByTestId("sidebar-compose-state")).toHaveTextContent("compose open")

    fireEvent.click(screen.getByRole("button", { name: "Open workspace menu" }))
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings/profile")
    expect(screen.getByRole("link", { name: /Notifications/ })).toHaveAttribute("href", "/activity")
    fireEvent.click(screen.getByRole("button", { name: /Log out/ }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("collapses grouped navigation sections", async () => {
    render(<AppSidebar />)

    await waitFor(() => expect(api.getCounts).toHaveBeenCalled())
    expect(screen.getByRole("link", { name: /Commitments/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }))
    expect(screen.queryByRole("link", { name: /Commitments/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }))
    expect(screen.getByRole("link", { name: /Commitments/ })).toBeInTheDocument()
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

  it("refreshes from update events and tolerates optional endpoint failures", async () => {
    api.listAgentActivity.mockRejectedValue(new Error("activity unavailable"))
    api.listCommitments.mockRejectedValue(new Error("commitments unavailable"))
    render(<AppSidebar />)

    await waitFor(() => expect(api.getCounts).toHaveBeenCalledTimes(1))
    for (const eventName of [
      "focus",
      "relay-emails-updated",
      "relay-agent-activity-updated",
      "relay-commitments-updated",
    ]) {
      fireEvent(window, new Event(eventName))
    }
    await waitFor(() => expect(api.getCounts).toHaveBeenCalledTimes(5))
  })

  it("dismisses the workspace menu by links, outside presses, and Escape", async () => {
    render(<AppSidebar />)
    await waitFor(() => expect(api.getCounts).toHaveBeenCalled())
    const trigger = screen.getByRole("button", { name: "Open workspace menu" })

    fireEvent.click(trigger)
    const settings = screen.getByRole("link", { name: /Settings/ })
    fireEvent.pointerDown(settings)
    expect(settings).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: "Enter" })
    expect(screen.getByRole("link", { name: /Settings/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument()

    for (const linkName of [/Settings/, /Notifications/, /Connected accounts/]) {
      fireEvent.click(trigger)
      fireEvent.click(screen.getByRole("link", { name: linkName }))
      expect(screen.queryByRole("link", { name: /Notifications/ })).not.toBeInTheDocument()
    }
  })

  it("renders every display-name fallback", async () => {
    const users = [
      { email: "owner@example.com", user_metadata: { name: "Owner Name" } },
      { email: "email-only@example.com", user_metadata: {} },
      null,
      { email: "@relay", user_metadata: {} },
    ]
    const expected = ["Owner Name", "email-only", "Sign out", "Relay"]

    for (let index = 0; index < users.length; index += 1) {
      mockedUseAuth.mockReturnValue({ user: users[index], signOut })
      const view = render(<AppSidebar />)
      expect(await screen.findByText(expected[index])).toBeInTheDocument()
      view.unmount()
    }
  })

  it("renders high counts and every account health label while resizing", async () => {
    sidebarResizing = true
    api.getCounts.mockResolvedValue({
      counts: { inboxUnread: 120, drafts: 0, archives: 0, sent: 0, trash: 0 },
    })
    api.listAccounts.mockResolvedValue([
      { id: "new", email: "new@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null, syncStatus: "never", unreadCount: 0 },
      { id: "busy", email: "busy@example.com", provider: "outlook", connectedAt: "", lastSyncedAt: null, syncStatus: "syncing", unreadCount: 120 },
      { id: "quiet", email: "quiet@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null, syncStatus: "syncing", unreadCount: 0 },
    ])

    render(<AppSidebar />)

    expect(await screen.findByText("New")).toBeInTheDocument()
    expect(screen.getAllByText("99+").length).toBeGreaterThan(0)
    expect(screen.getByText("99+ unread")).toBeInTheDocument()
    expect(screen.getByTitle("quiet@example.com")).toBeInTheDocument()
  })

  it("preserves empty state when the main refresh fails", async () => {
    api.getCounts.mockRejectedValue(new Error("offline"))
    render(<AppSidebar />)

    await waitFor(() => expect(api.getCounts).toHaveBeenCalled())
    expect(screen.queryByText("Gmail")).not.toBeInTheDocument()
  })
})

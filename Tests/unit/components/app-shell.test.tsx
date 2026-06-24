/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { AppShell } from "@/components/app-shell"

let pathname = "/commitments"
let query = new URLSearchParams()

const aiInboxChatMock = jest.fn(({ pageContext }: { pageContext?: string }) => (
  <div data-testid="mock-ai-chat">{pageContext}</div>
))

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => query,
}))

jest.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <aside>Sidebar</aside>,
}))

jest.mock("@/components/mobile-bottom-nav", () => ({
  MobileBottomNav: () => <nav>Mobile nav</nav>,
}))

jest.mock("@/components/ai-inbox-chat", () => ({
  AiInboxChat: (props: any) => aiInboxChatMock(props),
}))

describe("AppShell AI chat launcher", () => {
  beforeEach(() => {
    pathname = "/commitments"
    query = new URLSearchParams()
    aiInboxChatMock.mockClear()
  })

  it("opens the shared chat launcher with current page context", () => {
    render(<AppShell><main>Commitments content</main></AppShell>)

    fireEvent.click(screen.getByRole("button", { name: "Ask Relay" }))

    expect(screen.getByTestId("mock-ai-chat")).toHaveTextContent("Commitments page")
    expect(aiInboxChatMock).toHaveBeenCalledWith(expect.objectContaining({
      pageContext: expect.stringContaining("Commitments page"),
    }))
  })

  it("passes selected email context from the current route", () => {
    pathname = "/inbox"
    query = new URLSearchParams({
      message: "message-1",
      messageAccount: "account-1",
    })

    render(<AppShell><main>Inbox content</main></AppShell>)
    fireEvent.click(screen.getByRole("button", { name: "Ask Relay" }))

    expect(aiInboxChatMock).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "account-1",
      messageId: "message-1",
      pageContext: expect.stringContaining("Inbox page"),
    }))
  })
})

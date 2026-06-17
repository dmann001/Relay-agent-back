/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

let pathname = "/inbox"

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

jest.mock("@/components/compose-dialog", () => ({
  ComposeDialog: ({ open }: { open: boolean }) => (
    <div data-testid="mobile-compose-state">{open ? "compose open" : "compose closed"}</div>
  ),
}))

describe("MobileBottomNav", () => {
  beforeEach(() => {
    pathname = "/inbox"
  })

  it("renders the primary mobile destinations", () => {
    render(<MobileBottomNav />)

    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute("href", "/inbox")
    expect(screen.getByRole("link", { name: "Sent" })).toHaveAttribute("href", "/sent")
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute("href", "/drafts")
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute("href", "/commitments")
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
  })

  it("opens compose from the center action", () => {
    render(<MobileBottomNav />)

    expect(screen.getByTestId("mobile-compose-state")).toHaveTextContent("compose closed")
    fireEvent.click(screen.getByRole("button", { name: "Compose email" }))
    expect(screen.getByTestId("mobile-compose-state")).toHaveTextContent("compose open")
  })
})

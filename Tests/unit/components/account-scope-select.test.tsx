/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AccountScopeSelect } from "@/components/account-scope-select"
import { emailApi } from "@/lib/email-api"

jest.mock("@/lib/email-api", () => ({
  emailApi: {
    listAccounts: jest.fn(),
  },
}))

const listAccounts = emailApi.listAccounts as jest.Mock

describe("AccountScopeSelect", () => {
  beforeEach(() => {
    listAccounts.mockReset()
  })

  it("stays hidden until multiple accounts are available", async () => {
    listAccounts.mockResolvedValue([
      { id: "work", email: "work@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
    ])

    render(<AccountScopeSelect value="" onChange={jest.fn()} />)

    await waitFor(() => expect(listAccounts).toHaveBeenCalled())
    expect(screen.queryByLabelText("Mailbox account")).not.toBeInTheDocument()
  })

  it("renders all accounts and forwards selection changes", async () => {
    const onChange = jest.fn()
    listAccounts.mockResolvedValue([
      { id: "work", email: "work@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
      { id: "personal", email: "me@example.com", provider: "outlook", connectedAt: "", lastSyncedAt: null },
    ])

    render(<AccountScopeSelect value="" onChange={onChange} />)

    // Options live in a themed popup, so they only exist once it is open.
    const trigger = await screen.findByLabelText("Mailbox account")
    fireEvent.click(trigger)

    expect(screen.getByRole("option", { name: /All accounts/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /work@example\.com/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /me@example\.com/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("option", { name: /me@example\.com/ }))
    expect(onChange).toHaveBeenCalledWith("personal")
  })

  it("clears a stale account id after accounts load", async () => {
    const onChange = jest.fn()
    listAccounts.mockResolvedValue([
      { id: "work", email: "work@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
      { id: "personal", email: "me@example.com", provider: "outlook", connectedAt: "", lastSyncedAt: null },
    ])

    render(<AccountScopeSelect value="missing" onChange={onChange} />)

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""))
  })

  it("maps the All accounts option to an empty value", async () => {
    const onChange = jest.fn()
    listAccounts.mockResolvedValue([
      { id: "work", email: "work@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
      { id: "personal", email: "me@example.com", provider: "outlook", connectedAt: "", lastSyncedAt: null },
    ])

    render(<AccountScopeSelect value="personal" onChange={onChange} className="wide" />)

    fireEvent.click(await screen.findByLabelText("Mailbox account"))
    fireEvent.click(screen.getByRole("option", { name: /All accounts/ }))
    expect(onChange).toHaveBeenCalledWith("")
  })

  it("ignores metadata failures and late responses after unmount", async () => {
    listAccounts.mockRejectedValueOnce(new Error("offline"))
    const first = render(<AccountScopeSelect value="" onChange={jest.fn()} />)
    await waitFor(() => expect(listAccounts).toHaveBeenCalledTimes(1))
    first.unmount()

    let resolveAccounts: (accounts: any[]) => void = () => undefined
    listAccounts.mockReturnValueOnce(new Promise((resolve) => {
      resolveAccounts = resolve
    }))
    const onChange = jest.fn()
    const second = render(<AccountScopeSelect value="missing" onChange={onChange} />)
    second.unmount()
    resolveAccounts([
      { id: "work", email: "work@example.com", provider: "gmail", connectedAt: "", lastSyncedAt: null },
    ])

    await Promise.resolve()
    expect(onChange).not.toHaveBeenCalled()
  })
})

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

    const select = await screen.findByLabelText("Mailbox account")
    expect(screen.getByRole("option", { name: "All accounts" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "work@example.com" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "me@example.com" })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: "personal" } })
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
})

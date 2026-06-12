import { NextRequest } from "next/server";
import { DELETE, GET } from "@/app/api/accounts/route";

const requireUser = jest.fn();
const listGmailAccounts = jest.fn();
const deleteGmailAccount = jest.fn();

jest.mock("@/lib/server/supabase-admin", () => {
  const actual = jest.requireActual("@/lib/server/supabase-admin");
  return {
    ...actual,
    requireUser: (...args: unknown[]) => requireUser(...args),
  };
});

jest.mock("@/lib/server/gmail-accounts", () => ({
  listGmailAccounts: (...args: unknown[]) => listGmailAccounts(...args),
  deleteGmailAccount: (...args: unknown[]) => deleteGmailAccount(...args),
}));

describe("/api/accounts", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue("user-123");
  });

  it("returns a token-free account view", async () => {
    listGmailAccounts.mockResolvedValue([{
      id: "account-1",
      email: "user@example.com",
      access_token: "must-not-leak",
      refresh_token: "must-not-leak",
      connected_at: "2026-06-01T00:00:00.000Z",
      last_sync_at: null,
    }]);

    const response = await GET(new NextRequest("http://localhost/api/accounts"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.accounts).toEqual([{
      id: "account-1",
      email: "user@example.com",
      provider: "gmail",
      connectedAt: "2026-06-01T00:00:00.000Z",
      lastSyncedAt: null,
    }]);
    expect(JSON.stringify(payload)).not.toContain("must-not-leak");
  });

  it("requires an account id before deleting", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/accounts", {
      method: "DELETE",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Account id is required" });
    expect(deleteGmailAccount).not.toHaveBeenCalled();
  });

  it("scopes deletion to the authenticated user", async () => {
    const response = await DELETE(new NextRequest(
      "http://localhost/api/accounts?id=account-1",
      { method: "DELETE" },
    ));

    expect(response.status).toBe(200);
    expect(deleteGmailAccount).toHaveBeenCalledWith("user-123", "account-1");
  });
});

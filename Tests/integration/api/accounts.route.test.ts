import { NextRequest } from "next/server";
import { DELETE, GET } from "@/app/api/accounts/route";

const requireUser = jest.fn();
const listGmailAccounts = jest.fn();
const deleteGmailAccount = jest.fn();
const getSupabaseAdmin = jest.fn();

jest.mock("@/lib/server/supabase-admin", () => {
  const actual = jest.requireActual("@/lib/server/supabase-admin");
  return {
    ...actual,
    requireUser: (...args: unknown[]) => requireUser(...args),
    getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
  };
});

jest.mock("@/lib/server/gmail-accounts", () => ({
  listGmailAccounts: (...args: unknown[]) => listGmailAccounts(...args),
  deleteGmailAccount: (...args: unknown[]) => deleteGmailAccount(...args),
}));

describe("/api/accounts", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue("user-123");
    const syncQuery: any = { select: jest.fn(), in: jest.fn().mockResolvedValue({ data: [], error: null }) };
    syncQuery.select.mockReturnValue(syncQuery);
    const unreadQuery: any = { select: jest.fn(), eq: jest.fn() };
    unreadQuery.select.mockReturnValue(unreadQuery);
    unreadQuery.eq.mockReturnValue(unreadQuery);
    unreadQuery.eq.mockImplementation(() => unreadQuery);
    unreadQuery.then = (resolve: any) => resolve({ count: 0, error: null });
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) => table === "email_sync_state" ? syncQuery : unreadQuery),
    });
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
      syncStatus: "never",
      lastError: null,
      unreadCount: 0,
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

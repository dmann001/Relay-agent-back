const getOutlookAccessToken = jest.fn().mockResolvedValue("token");
jest.mock("@/lib/server/outlook-accounts", () => ({
  getOutlookAccessToken: (...args: unknown[]) => getOutlookAccessToken(...args),
}));

import { getOutlookThread, modifyOutlookMessage, outlookMessageToEmail } from "@/lib/server/outlook-api";

const account = { id: "account", provider: "outlook" } as never;

describe("Microsoft Graph mail adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  it("normalizes Outlook messages into Relay emails", () => {
    expect(outlookMessageToEmail({
      id: "message",
      conversationId: "conversation",
      subject: "Hello",
      body: { contentType: "html", content: "<p>World</p>" },
      from: { emailAddress: { name: "Sender", address: "sender@example.com" } },
      toRecipients: [{ emailAddress: { address: "me@example.com" } }],
      isRead: false,
      flag: { flagStatus: "flagged" },
    }, "account")).toMatchObject({
      id: "message", threadId: "conversation", provider: "outlook",
      accountId: "account", read: false, isStarred: true,
      bodyPlain: "World",
    });
  });

  it("uses Graph move semantics for archive", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ id: "immutable-message" }),
    });
    await modifyOutlookMessage(account, "message", "archive");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/me/messages/message/move",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ destinationId: "archive" }) }),
    );
  });

  it("loads and chronologically sorts a conversation", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ value: [
        { id: "new", conversationId: "c", receivedDateTime: "2026-01-02T00:00:00Z" },
        { id: "old", conversationId: "c", receivedDateTime: "2026-01-01T00:00:00Z" },
      ] }),
    });
    const result = await getOutlookThread(account, { id: "selected", conversationId: "c" });
    expect(result.map(({ id }) => id)).toEqual(["old", "new"]);
  });

  it("refreshes the access token and retries once after a 401", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false, status: 401, headers: new Headers(),
        json: async () => ({ error: { code: "InvalidAuthenticationToken" } }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ id: "message" }),
      });
    const accountWithRefreshToken = {
      id: "account",
      provider: "outlook",
      email: "person@outlook.com",
      refresh_token: "refresh-token",
    } as never;

    await modifyOutlookMessage(accountWithRefreshToken, "message", "markRead");

    expect(getOutlookAccessToken).toHaveBeenNthCalledWith(1, accountWithRefreshToken);
    expect(getOutlookAccessToken).toHaveBeenNthCalledWith(2, accountWithRefreshToken, true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

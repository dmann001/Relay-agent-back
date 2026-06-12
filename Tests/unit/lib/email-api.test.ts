/**
 * @jest-environment jsdom
 */
const getSession = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSession(...args) } },
}));

import { emailApi, EmailApiError } from "@/lib/email-api";

const response = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(payload),
});

describe("email API client", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });
    global.fetch = jest.fn();
  });

  it("sends authenticated list parameters", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({ emails: [], total: 0 }));

    await emailApi.listEmails("inbox", {
      limit: 25,
      offset: 50,
      category: "promotions",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/emails?mailbox=inbox&limit=25&offset=50&category=promotions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("rejects calls when no Supabase session exists", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(emailApi.getCounts()).rejects.toMatchObject({
      message: "Not signed in",
      status: 401,
      code: "NO_SESSION",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("maps backend errors into EmailApiError", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ message: "Reconnect Gmail", code: "AUTH_EXPIRED" }, 401),
    );

    const error = await emailApi.getCounts().catch((caught) => caught);
    expect(error).toBeInstanceOf(EmailApiError);
    expect(error).toMatchObject({
      message: "Reconnect Gmail",
      status: 401,
      code: "AUTH_EXPIRED",
    });
  });

  it("dispatches update events after mutations", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({ results: [] }));
    const listener = jest.fn();
    window.addEventListener("relay-emails-updated", listener);

    await emailApi.sync("inbox", { force: true });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/emails/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mailbox: "inbox", force: true }),
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("URL-encodes account and draft identifiers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({ success: true }));

    await emailApi.disconnectAccount("account/with spaces");
    await emailApi.deleteDraft("draft/with spaces");

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/accounts?id=account%2Fwith%20spaces",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/drafts?id=draft%2Fwith%20spaces",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("maps the remaining public API operations", async () => {
    const payloads = [
      { email: { id: "message-1" } },
      { success: true },
      { data: "attachment-data" },
      { messageId: "sent-1", threadId: "thread-1" },
      { drafts: [{ id: "draft-1" }] },
      { draftId: "draft-1", gmailDraftId: "gmail-draft-1" },
      { accounts: [{ id: "account-1" }] },
      { url: "https://accounts.google.com/oauth" },
    ];
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(response(payloads.shift())),
    );

    await expect(emailApi.getEmail("message-1")).resolves.toMatchObject({ id: "message-1" });
    await expect(emailApi.modifyEmail("message-1", "archive")).resolves.toBeUndefined();
    await expect(emailApi.getAttachment("message-1", "attachment-1")).resolves.toBe(
      "attachment-data",
    );
    await expect(
      emailApi.sendEmail({
        to: ["recipient@example.com"],
        subject: "Hello",
        body: "World",
      }),
    ).resolves.toEqual({ messageId: "sent-1", threadId: "thread-1" });
    await expect(emailApi.listDrafts()).resolves.toEqual([{ id: "draft-1" }]);
    await expect(
      emailApi.saveDraft({
        to: [],
        subject: "Draft",
        body: "Body",
      }),
    ).resolves.toEqual({ draftId: "draft-1", gmailDraftId: "gmail-draft-1" });
    await expect(emailApi.listAccounts()).resolves.toEqual([{ id: "account-1" }]);
    await expect(emailApi.getGmailConnectUrl()).resolves.toBe(
      "https://accounts.google.com/oauth",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/emails/message-1/modify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "archive" }),
      }),
    );
  });
});

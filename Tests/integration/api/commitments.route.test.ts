import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/commitments/route";
import { PATCH } from "@/app/api/commitments/[id]/route";

const requireUser = jest.fn();
const getSupabaseAdmin = jest.fn();
const getEmailAccount = jest.fn();
const getOwnedCommitment = jest.fn();

jest.mock("@/lib/server/supabase-admin", () => {
  const actual = jest.requireActual("@/lib/server/supabase-admin");
  return {
    ...actual,
    requireUser: (...args: unknown[]) => requireUser(...args),
    getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
  };
});

jest.mock("@/lib/server/email-accounts", () => ({
  getEmailAccount: (...args: unknown[]) => getEmailAccount(...args),
}));

jest.mock("@/lib/server/commitments", () => {
  const actual = jest.requireActual("@/lib/server/commitments");
  return {
    ...actual,
    getOwnedCommitment: (...args: unknown[]) => getOwnedCommitment(...args),
  };
});

function query(result: unknown) {
  const chain: any = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
  };
  for (const method of ["select", "eq", "in", "order", "limit", "insert", "update"]) {
    chain[method].mockReturnValue(chain);
  }
  chain.then = (resolve: (value: unknown) => void) => resolve(result);
  chain.maybeSingle.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

const account = {
  id: "30f6324f-b0ad-4c24-9a1d-c610b8259482",
  user_id: "user-123",
  email: "work@example.com",
  provider: "outlook",
};

const commitmentRow = {
  id: "commitment-1",
  user_id: "user-123",
  account_id: account.id,
  source_email_id: "email-1",
  source_thread_id: "thread-1",
  provider: "outlook",
  provider_message_id: "message-1",
  provider_thread_id: "conversation-1",
  type: "my_task",
  title: "Send revised proposal",
  description: "",
  expected_outcome: "Send revised proposal",
  owner_name: "You",
  owner_email: null,
  due_at: "2026-06-20T17:00:00.000Z",
  timezone: "UTC",
  evidence: "Please send it by Friday.",
  status: "active",
  snoozed_until: null,
  confirmed_at: "2026-06-15T12:00:00.000Z",
  satisfied_at: null,
  dismissed_at: null,
  created_at: "2026-06-15T12:00:00.000Z",
  updated_at: "2026-06-15T12:00:00.000Z",
};

describe("/api/commitments", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue("user-123");
    getEmailAccount.mockResolvedValue(account);
    getOwnedCommitment.mockResolvedValue(commitmentRow);
  });

  it("lists user-scoped commitments with provider context", async () => {
    const commitments = query({ data: [commitmentRow], error: null });
    const accounts = query({ data: [account], error: null });
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) => table === "commitments" ? commitments : accounts),
    });

    const response = await GET(new NextRequest("http://localhost/api/commitments"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(commitments.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(payload.commitments[0]).toMatchObject({
      id: "commitment-1",
      provider: "outlook",
      accountEmail: "work@example.com",
      title: "Send revised proposal",
    });
  });

  it("creates a commitment only from an owned synced email", async () => {
    const source = query({
      data: {
        id: "email-1",
        thread_id: "thread-1",
        provider: "outlook",
        provider_message_id: "message-1",
        provider_thread_id: "conversation-1",
      },
      error: null,
    });
    const duplicates = query({ data: [], error: null });
    const insert = query({ data: commitmentRow, error: null });
    let commitmentCalls = 0;
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "emails") return source;
        commitmentCalls += 1;
        return commitmentCalls === 1 ? duplicates : insert;
      }),
    });

    const response = await POST(new NextRequest("http://localhost/api/commitments", {
      method: "POST",
      body: JSON.stringify({
        accountId: account.id,
        providerMessageId: "message-1",
        type: "my_task",
        title: "Send revised proposal",
        ownerName: "You",
        dueAt: "2026-06-20T17:00:00.000Z",
        timezone: "UTC",
        evidence: "Please send it by Friday.",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(getEmailAccount).toHaveBeenCalledWith("user-123", account.id);
    expect(source.eq).toHaveBeenCalledWith("account_id", account.id);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-123",
      provider: "outlook",
      provider_message_id: "message-1",
      status: "active",
    }));
    expect(payload.commitment.title).toBe("Send revised proposal");
  });

  it("rejects duplicate active commitments from the same message", async () => {
    const source = query({
      data: {
        id: "email-1",
        thread_id: "thread-1",
        provider: "outlook",
        provider_message_id: "message-1",
        provider_thread_id: "conversation-1",
      },
      error: null,
    });
    const duplicates = query({ data: [{ id: "existing" }], error: null });
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) => table === "emails" ? source : duplicates),
    });

    const response = await POST(new NextRequest("http://localhost/api/commitments", {
      method: "POST",
      body: JSON.stringify({
        accountId: account.id,
        providerMessageId: "message-1",
        type: "my_task",
        title: "Send revised proposal",
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "DUPLICATE_COMMITMENT" });
  });

  it("completes an owned commitment and records its completion time", async () => {
    const updated = query({
      data: { ...commitmentRow, status: "satisfied", satisfied_at: "2026-06-15T13:00:00.000Z" },
      error: null,
    });
    const accountQuery = query({ data: account, error: null });
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) => table === "commitments" ? updated : accountQuery),
    });

    const response = await PATCH(new NextRequest("http://localhost/api/commitments/commitment-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "complete" }),
    }), { params: Promise.resolve({ id: "commitment-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "satisfied",
      snoozed_until: null,
    }));
    expect(payload.commitment.status).toBe("satisfied");
  });
});


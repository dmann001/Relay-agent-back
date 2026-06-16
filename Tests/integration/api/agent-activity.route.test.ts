import { NextRequest } from "next/server";
import { GET as listActivity } from "@/app/api/agent-activity/route";
import {
  GET as getActivity,
  PATCH as controlActivity,
} from "@/app/api/agent-activity/[id]/route";

const requireUser = jest.fn();
const getSupabaseAdmin = jest.fn();
const appendAgentActivityEvent = jest.fn();

jest.mock("@/lib/server/supabase-admin", () => {
  const actual = jest.requireActual("@/lib/server/supabase-admin");
  return {
    ...actual,
    requireUser: (...args: unknown[]) => requireUser(...args),
    getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdmin(...args),
  };
});

jest.mock("@/lib/server/agent-activity", () => {
  const actual = jest.requireActual("@/lib/server/agent-activity");
  return {
    ...actual,
    appendAgentActivityEvent: (...args: unknown[]) =>
      appendAgentActivityEvent(...args),
  };
});

function chain(result: unknown) {
  const query: any = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    update: jest.fn(),
  };
  for (const method of ["select", "eq", "in", "order", "limit", "update"]) {
    query[method].mockReturnValue(query);
  }
  query.then = (resolve: (value: unknown) => void) => resolve(result);
  query.maybeSingle.mockResolvedValue(result);
  query.single.mockResolvedValue(result);
  return query;
}

const run = {
  id: "run-1",
  user_id: "user-123",
  account_id: "account-1",
  agent_type: "meeting_brief_prepare",
  source_type: "meeting",
  source_id: "event-1",
  title: "Prepare Project Atlas briefing",
  summary: "Gather related email context.",
  status: "failed",
  current_stage: "threads_retrieved",
  progress_current: 2,
  progress_total: 5,
  scheduled_for: null,
  started_at: "2026-06-15T10:00:00.000Z",
  completed_at: "2026-06-15T10:01:00.000Z",
  attempt_count: 0,
  max_attempts: 3,
  error_code: "PROVIDER_ERROR",
  error_message: "Provider unavailable",
  created_at: "2026-06-15T09:59:00.000Z",
  updated_at: "2026-06-15T10:01:00.000Z",
};

describe("/api/agent-activity", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue("user-123");
    appendAgentActivityEvent.mockResolvedValue({});
  });

  it("returns user-scoped activities and the attention count", async () => {
    const runsQuery = chain({ data: [run], error: null });
    const accountsQuery = chain({
      data: [{ id: "account-1", email: "work@example.com", provider: "outlook" }],
      error: null,
    });
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) =>
        table === "agent_runs" ? runsQuery : accountsQuery,
      ),
    });

    const response = await listActivity(
      new NextRequest("http://localhost/api/agent-activity"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(runsQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(payload.needsAttention).toBe(1);
    expect(payload.activities[0]).toMatchObject({
      id: "run-1",
      provider: "outlook",
      accountEmail: "work@example.com",
      status: "failed",
    });
  });

  it("rejects invalid list filters", async () => {
    const response = await listActivity(
      new NextRequest("http://localhost/api/agent-activity?status=unknown"),
    );

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns a run with its ordered timeline", async () => {
    const runQuery = chain({ data: run, error: null });
    const eventQuery = chain({
      data: [{
        id: "event-1",
        event_type: "failed",
        stage: "threads_retrieved",
        message: "Provider unavailable.",
        metadata: {},
        created_at: "2026-06-15T10:01:00.000Z",
      }],
      error: null,
    });
    const accountQuery = chain({
      data: { email: "work@example.com", provider: "outlook" },
      error: null,
    });
    getSupabaseAdmin.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === "agent_runs") return runQuery;
        if (table === "agent_activity_events") return eventQuery;
        return accountQuery;
      }),
    });

    const response = await getActivity(
      new NextRequest("http://localhost/api/agent-activity/run-1"),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activity.accountEmail).toBe("work@example.com");
    expect(payload.events).toEqual([
      expect.objectContaining({ eventType: "failed", message: "Provider unavailable." }),
    ]);
  });

  it("queues failed activity for retry and records the action", async () => {
    const runQuery = chain({ data: run, error: null });
    const updated = {
      ...run,
      status: "queued",
      attempt_count: 1,
      error_code: null,
      error_message: null,
    };
    runQuery.single.mockResolvedValue({ data: updated, error: null });
    getSupabaseAdmin.mockReturnValue({ from: jest.fn(() => runQuery) });

    const response = await controlActivity(
      new NextRequest("http://localhost/api/agent-activity/run-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "retry" }),
      }),
      { params: Promise.resolve({ id: "run-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activity.status).toBe("queued");
    expect(appendAgentActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        agentRunId: "run-1",
        eventType: "retried",
      }),
    );
  });
});


// Frontend client for the Relay email backend.
//
// Flow: list views read cached metadata from the Relay DB (fast), a background
// sync pulls changes from Gmail, and full email bodies are fetched live from
// Gmail only when the user opens an email. Gmail OAuth tokens stay on the
// server - requests are authenticated with the Supabase session token.
import { supabase } from "@/lib/supabase/client";
import type { Email, EmailProvider } from "@/types";

export type Mailbox = "inbox" | "sent" | "archive" | "trash";
export type EmailAction =
  | "archive"
  | "unarchive"
  | "trash"
  | "untrash"
  | "markRead"
  | "markUnread"
  | "star"
  | "unstar";

export interface ConnectedAccount {
  id: string;
  email: string;
  provider: EmailProvider;
  connectedAt: string;
  lastSyncedAt: string | null;
  syncStatus?: "healthy" | "syncing" | "error" | "never";
  lastError?: string | null;
  unreadCount?: number;
}

export interface RemoteDraft {
  id: string;
  providerDraftId?: string | null;
  gmailDraftId: string | null;
  accountId: string | null;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  body: string;
  inReplyTo?: string;
  status: "saved" | "saving" | "failed";
  lastEdited: string;
  provider: EmailProvider;
}

export type ThreadAiResult =
  | {
      kind: "summary";
      summary: string;
      keyPoints: string[];
      openQuestions: string[];
      suggestedAction: string;
    }
  | { kind: "draft"; draft: string; rationale: string; assumptions: string[] }
  | {
      kind: "tasks";
      tasks: Array<{
        title: string;
        owner: string;
        dueDate: string;
        evidence: string;
      }>;
      notes: string;
    }
  | { kind: "answer"; answer: string; evidence: string[] };

export interface ThreadAiResponse {
  result: ThreadAiResult;
  context: {
    accountId: string;
    accountEmail: string;
    messageId: string;
    subject: string;
  };
  model: string;
  responseId?: string;
}

export interface InboxBrief {
  overview: string;
  needsReply: Array<{ messageId: string; subject: string; reason: string }>;
  deadlines: Array<{
    messageId: string;
    subject: string;
    date: string;
    evidence: string;
  }>;
  notable: Array<{ messageId: string; subject: string; reason: string }>;
}

export interface AiAccountPreference {
  accountId: string;
  accountEmail: string;
  displayName: string;
  writingStyle: string;
  signature: string;
  draftInstructions: string;
  aiEnabled: boolean;
}

export interface SyncResultSummary {
  accountId: string;
  email: string;
  synced: number;
  deleted: number;
  mode: "initial" | "incremental" | "list" | "skipped" | "loadMore";
  hasMore?: boolean;
  error?: string;
}

export type AgentActivityStatus =
  | "draft"
  | "awaiting_approval"
  | "scheduled"
  | "queued"
  | "running"
  | "needs_input"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";

export interface AgentActivity {
  id: string;
  accountId: string | null;
  accountEmail: string | null;
  provider: EmailProvider | null;
  agentType:
    | "commitment_monitor"
    | "calendar_event_create"
    | "calendar_event_update"
    | "calendar_event_delete"
    | "meeting_brief_prepare"
    | "meeting_brief_refresh";
  sourceType: "email" | "thread" | "commitment" | "calendar_event" | "meeting" | null;
  sourceId: string | null;
  title: string;
  summary: string;
  status: AgentActivityStatus;
  currentStage: string | null;
  progressCurrent: number;
  progressTotal: number | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  output: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentActivityEvent {
  id: string;
  eventType: string;
  stage: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type CommitmentType =
  | "my_task"
  | "waiting_for_reply"
  | "waiting_for_artifact"
  | "follow_up";

export type CommitmentStatus =
  | "active"
  | "needs_review"
  | "satisfied"
  | "dismissed"
  | "expired";

export interface Commitment {
  id: string;
  accountId: string | null;
  accountEmail: string | null;
  provider: EmailProvider | null;
  sourceEmailId: string | null;
  sourceThreadId: string | null;
  providerMessageId: string | null;
  providerThreadId: string | null;
  type: CommitmentType;
  title: string;
  description: string;
  expectedOutcome: string;
  ownerName: string;
  ownerEmail: string | null;
  dueAt: string | null;
  timezone: string;
  evidence: string;
  status: CommitmentStatus;
  snoozedUntil: string | null;
  confirmedAt: string;
  satisfiedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarConnection {
  id: string;
  accountId: string;
  accountEmail: string | null;
  provider: EmailProvider;
  status: "connected" | "error" | "revoked";
  scopes: string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
}

export interface CommitmentCalendarEvent {
  id: string;
  accountId: string;
  commitmentId: string;
  provider: EmailProvider;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "active" | "deleted" | "error";
  createdAt: string;
}

export interface CommitmentMonitor {
  id: string;
  commitmentId: string;
  status: "active" | "paused";
  cadenceHours: number;
  nextCheckAt: string;
  lastCheckedAt: string | null;
  lastResult: string | null;
}

export interface MeetingBrief {
  id: string;
  accountId: string;
  commitmentId: string;
  title: string;
  meetingAt: string;
  status: "ready" | "failed";
  overview: string;
  objectives: string[];
  contextPoints: string[];
  openQuestions: string[];
  suggestedTalkingPoints: string[];
  sourceMessageIds: string[];
  errorMessage: string | null;
  createdAt: string;
}

export class EmailApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const notifyEmailsUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("relay-emails-updated"));
  }
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new EmailApiError("Not signed in", 401, "NO_SESSION");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new EmailApiError(
      payload?.message ||
        payload?.error ||
        `Request failed (${response.status})`,
      response.status,
      payload?.code,
    );
  }
  return payload as T;
}

export const emailApi = {
  // ---- Email metadata cache (Relay DB) ----

  async listEmails(
    mailbox: Mailbox,
    options: {
      limit?: number;
      offset?: number;
      category?: Email["gmailCategory"];
      accountId?: string;
    } = {},
  ): Promise<{
    emails: Email[];
    total: number;
    unreadTotal?: number;
    hasMore?: boolean;
  }> {
    const params = new URLSearchParams({
      mailbox,
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    });
    if (options.category) params.set("category", options.category);
    if (options.accountId) params.set("accountId", options.accountId);
    return request(`/api/emails?${params.toString()}`);
  },

  async getCounts(): Promise<{
    counts: {
      inboxUnread: number;
      sent: number;
      archives: number;
      trash: number;
      drafts: number;
    };
  }> {
    return request("/api/emails/counts");
  },

  // ---- Provider sync ----

  async sync(
    mailbox?: Mailbox | "drafts",
    options: {
      force?: boolean;
      loadMore?: boolean;
      category?: Email["gmailCategory"];
      accountId?: string;
    } = {},
  ): Promise<{ results: SyncResultSummary[] }> {
    const result = await request<{ results: SyncResultSummary[] }>(
      "/api/emails/sync",
      {
        method: "POST",
        body: JSON.stringify({
          ...(mailbox ? { mailbox } : {}),
          ...(options.force ? { force: true } : {}),
          ...(options.loadMore ? { loadMore: true } : {}),
          ...(options.category ? { category: options.category } : {}),
          ...(options.accountId ? { accountId: options.accountId } : {}),
        }),
      },
    );
    notifyEmailsUpdated();
    return result;
  },

  // ---- Single email (full body fetched live from the provider) ----

  async getEmail(messageId: string, accountId?: string): Promise<Email> {
    const suffix = accountId
      ? `?accountId=${encodeURIComponent(accountId)}`
      : "";
    const { email } = await request<{ email: Email }>(
      `/api/emails/${messageId}${suffix}`,
    );
    return email;
  },

  async getThread(
    messageId: string,
    accountId?: string,
  ): Promise<{
    messages: Email[];
    accountId: string;
    accountEmail: string;
    threadId: string;
  }> {
    const suffix = accountId
      ? `?accountId=${encodeURIComponent(accountId)}`
      : "";
    return request(`/api/emails/${messageId}/thread${suffix}`);
  },

  async modifyEmail(
    messageId: string,
    action: EmailAction,
    accountId?: string,
  ): Promise<void> {
    await request(`/api/emails/${messageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ action, ...(accountId ? { accountId } : {}) }),
    });
    notifyEmailsUpdated();
  },

  async getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<string> {
    const { data } = await request<{ data: string }>("/api/emails/attachment", {
      method: "POST",
      body: JSON.stringify({ messageId, attachmentId }),
    });
    return data;
  },

  // ---- Sending ----

  async sendEmail(payload: {
    accountId?: string;
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    threadId?: string;
    inReplyToMessageId?: string;
    attachments?: Array<{ filename: string; mimeType: string; data: string }>;
    draftId?: string;
  }): Promise<{ messageId?: string; threadId?: string }> {
    const result = await request<{ messageId?: string; threadId?: string }>(
      "/api/emails/send",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    notifyEmailsUpdated();
    return result;
  },

  // ---- Drafts (autosaved to Gmail; DB stores preview only) ----

  async listDrafts(accountId?: string): Promise<RemoteDraft[]> {
    const query = accountId
      ? `?accountId=${encodeURIComponent(accountId)}`
      : "";
    const { drafts } = await request<{ drafts: RemoteDraft[] }>(
      `/api/drafts${query}`,
    );
    return drafts;
  },

  async saveDraft(payload: {
    draftId?: string;
    accountId?: string;
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    threadId?: string;
    inReplyToMessageId?: string;
  }): Promise<{ draftId: string; gmailDraftId: string }> {
    const result = await request<{ draftId: string; gmailDraftId: string }>(
      "/api/drafts",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    notifyEmailsUpdated();
    return result;
  },

  async deleteDraft(draftId: string): Promise<void> {
    await request(`/api/drafts?id=${encodeURIComponent(draftId)}`, {
      method: "DELETE",
    });
    notifyEmailsUpdated();
  },

  // ---- Accounts ----

  async listAccounts(): Promise<ConnectedAccount[]> {
    const { accounts } = await request<{ accounts: ConnectedAccount[] }>(
      "/api/accounts",
    );
    return accounts;
  },

  async disconnectAccount(accountId: string): Promise<void> {
    await request(`/api/accounts?id=${encodeURIComponent(accountId)}`, {
      method: "DELETE",
    });
    notifyEmailsUpdated();
  },

  async getGmailConnectUrl(): Promise<string> {
    const { url } = await request<{ url: string }>("/api/auth/gmail");
    return url;
  },

  async getOutlookConnectUrl(): Promise<string> {
    const { url } = await request<{ url: string }>("/api/auth/outlook");
    return url;
  },

  // ---- Calendar permissions and commitment reminders ----

  async listCalendarConnections(): Promise<CalendarConnection[]> {
    const { connections } = await request<{ connections: CalendarConnection[] }>("/api/calendar/connections");
    return connections;
  },

  async getCalendarConnectUrl(provider: EmailProvider, accountId: string): Promise<string> {
    const { url } = await request<{ url: string }>(
      `/api/calendar/connect/${provider}?accountId=${encodeURIComponent(accountId)}`,
    );
    return url;
  },

  async listCommitmentCalendarEvents(): Promise<CommitmentCalendarEvent[]> {
    const { events } = await request<{ events: CommitmentCalendarEvent[] }>("/api/calendar/events");
    return events;
  },

  async createCommitmentCalendarEvent(
    commitmentId: string,
    reminderMinutes = 30,
  ): Promise<CommitmentCalendarEvent> {
    const { event } = await request<{ event: CommitmentCalendarEvent }>("/api/calendar/events", {
      method: "POST",
      body: JSON.stringify({ commitmentId, reminderMinutes }),
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("relay-agent-activity-updated"));
    return event;
  },

  async deleteCommitmentCalendarEvent(id: string): Promise<void> {
    await request(`/api/calendar/events/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("relay-agent-activity-updated"));
  },

  async listCommitmentMonitors(): Promise<CommitmentMonitor[]> {
    const { monitors } = await request<{ monitors: CommitmentMonitor[] }>("/api/commitment-monitors");
    return monitors;
  },

  async enableCommitmentMonitor(commitmentId: string, cadenceHours = 24): Promise<CommitmentMonitor> {
    const { monitor } = await request<{ monitor: CommitmentMonitor }>(
      `/api/commitments/${encodeURIComponent(commitmentId)}/monitor`,
      { method: "PUT", body: JSON.stringify({ cadenceHours }) },
    );
    if (typeof window !== "undefined") window.dispatchEvent(new Event("relay-agent-activity-updated"));
    return monitor;
  },

  async disableCommitmentMonitor(commitmentId: string): Promise<void> {
    await request(`/api/commitments/${encodeURIComponent(commitmentId)}/monitor`, { method: "DELETE" });
  },

  async listMeetingBriefs(): Promise<MeetingBrief[]> {
    const { briefs } = await request<{ briefs: MeetingBrief[] }>("/api/meeting-briefs");
    return briefs;
  },

  async prepareMeetingBrief(commitmentId: string): Promise<MeetingBrief> {
    const { brief } = await request<{ brief: MeetingBrief }>("/api/meeting-briefs", {
      method: "POST", body: JSON.stringify({ commitmentId }),
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("relay-agent-activity-updated"));
    return brief;
  },

  // ---- Contextual AI (read-only analysis and draft generation) ----

  async runThreadAi(payload: {
    messageId: string;
    action: "summary" | "draft" | "tasks" | "ask";
    accountId?: string;
    prompt?: string;
  }): Promise<ThreadAiResponse> {
    return request<ThreadAiResponse>("/api/ai/thread", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getInboxBrief(accountId?: string): Promise<{
    brief: InboxBrief;
    scope: Array<{ id: string; email: string }>;
    model: string;
  }> {
    return request("/api/ai/brief", {
      method: "POST",
      body: JSON.stringify(accountId ? { accountId } : {}),
    });
  },

  async listAiPreferences(): Promise<AiAccountPreference[]> {
    const { preferences } = await request<{
      preferences: AiAccountPreference[];
    }>("/api/ai/preferences");
    return preferences;
  },

  async updateAiPreference(
    preference: Omit<AiAccountPreference, "accountEmail" | "displayName">,
  ): Promise<AiAccountPreference> {
    const { preference: updated } = await request<{
      preference: AiAccountPreference;
    }>("/api/ai/preferences", {
      method: "PATCH",
      body: JSON.stringify(preference),
    });
    return updated;
  },

  // ---- Visible agent activity ----

  async listAgentActivity(options: {
    status?: AgentActivityStatus;
    limit?: number;
  } = {}): Promise<{ activities: AgentActivity[]; needsAttention: number }> {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.limit) params.set("limit", String(options.limit));
    const query = params.size ? `?${params.toString()}` : "";
    return request(`/api/agent-activity${query}`);
  },

  async getAgentActivity(id: string): Promise<{
    activity: AgentActivity;
    events: AgentActivityEvent[];
  }> {
    return request(`/api/agent-activity/${encodeURIComponent(id)}`);
  },

  async controlAgentActivity(
    id: string,
    action: "cancel" | "retry",
  ): Promise<AgentActivity> {
    const { activity } = await request<{ activity: AgentActivity }>(
      `/api/agent-activity/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ action }) },
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("relay-agent-activity-updated"));
    }
    return activity;
  },

  // ---- Email commitments ----

  async listCommitments(options: {
    status?: CommitmentStatus;
    accountId?: string;
    limit?: number;
  } = {}): Promise<{ commitments: Commitment[]; needsAttention: number }> {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.accountId) params.set("accountId", options.accountId);
    if (options.limit) params.set("limit", String(options.limit));
    const query = params.size ? `?${params.toString()}` : "";
    return request(`/api/commitments${query}`);
  },

  async createCommitment(payload: {
    accountId: string;
    providerMessageId: string;
    type: CommitmentType;
    title: string;
    description?: string;
    expectedOutcome?: string;
    ownerName?: string;
    ownerEmail?: string;
    dueAt?: string | null;
    timezone?: string;
    evidence?: string;
  }): Promise<Commitment> {
    const { commitment } = await request<{ commitment: Commitment }>("/api/commitments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("relay-commitments-updated"));
    return commitment;
  },

  async updateCommitment(
    id: string,
    payload:
      | { action: "complete" | "reopen" | "dismiss" }
      | { action: "snooze"; until: string }
      | {
          action: "update";
          type?: CommitmentType;
          title?: string;
          description?: string;
          expectedOutcome?: string;
          ownerName?: string;
          ownerEmail?: string;
          dueAt?: string | null;
          timezone?: string;
        },
  ): Promise<Commitment> {
    const { commitment } = await request<{ commitment: Commitment }>(
      `/api/commitments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    if (typeof window !== "undefined") window.dispatchEvent(new Event("relay-commitments-updated"));
    return commitment;
  },
};

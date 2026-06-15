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
};

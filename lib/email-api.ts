// Frontend client for the Relay email backend.
//
// Flow: list views read cached metadata from the Relay DB (fast), a background
// sync pulls changes from Gmail, and full email bodies are fetched live from
// Gmail only when the user opens an email. Gmail OAuth tokens stay on the
// server - requests are authenticated with the Supabase session token.
import { supabase } from '@/lib/supabase/client';
import type { Email } from '@/types';

export type Mailbox = 'inbox' | 'sent' | 'archive' | 'trash';
export type EmailAction =
  | 'archive'
  | 'unarchive'
  | 'trash'
  | 'untrash'
  | 'markRead'
  | 'markUnread'
  | 'star'
  | 'unstar';

export interface ConnectedAccount {
  id: string;
  email: string;
  provider: 'gmail';
  connectedAt: string;
  lastSyncedAt: string | null;
}

export interface RemoteDraft {
  id: string;
  gmailDraftId: string | null;
  accountId: string | null;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  body: string;
  inReplyTo?: string;
  status: 'saved' | 'saving' | 'failed';
  lastEdited: string;
  provider: 'gmail';
}

export interface SyncResultSummary {
  accountId: string;
  email: string;
  synced: number;
  deleted: number;
  mode: 'initial' | 'incremental' | 'list' | 'skipped' | 'loadMore';
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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('relay-emails-updated'));
  }
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new EmailApiError('Not signed in', 401, 'NO_SESSION');
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new EmailApiError(
      payload?.message || payload?.error || `Request failed (${response.status})`,
      response.status,
      payload?.code
    );
  }
  return payload as T;
}

export const emailApi = {
  // ---- Email metadata cache (Relay DB) ----

  async listEmails(
    mailbox: Mailbox,
    options: { limit?: number; offset?: number; category?: Email['gmailCategory'] } = {}
  ): Promise<{ emails: Email[]; total: number; hasMore?: boolean }> {
    const params = new URLSearchParams({
      mailbox,
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
    });
    if (options.category) params.set('category', options.category);
    return request(`/api/emails?${params.toString()}`);
  },

  async getCounts(): Promise<{
    counts: { inboxUnread: number; sent: number; archives: number; trash: number; drafts: number };
  }> {
    return request('/api/emails/counts');
  },

  // ---- Gmail sync ----

  async sync(
    mailbox?: Mailbox | 'drafts',
    options: { force?: boolean; loadMore?: boolean } = {}
  ): Promise<{ results: SyncResultSummary[] }> {
    const result = await request<{ results: SyncResultSummary[] }>('/api/emails/sync', {
      method: 'POST',
      body: JSON.stringify({
        ...(mailbox ? { mailbox } : {}),
        ...(options.force ? { force: true } : {}),
        ...(options.loadMore ? { loadMore: true } : {}),
      }),
    });
    notifyEmailsUpdated();
    return result;
  },

  // ---- Single email (full body fetched live from Gmail) ----

  async getEmail(messageId: string): Promise<Email> {
    const { email } = await request<{ email: Email }>(`/api/emails/${messageId}`);
    return email;
  },

  async modifyEmail(messageId: string, action: EmailAction): Promise<void> {
    await request(`/api/emails/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    notifyEmailsUpdated();
  },

  async getAttachment(messageId: string, attachmentId: string): Promise<string> {
    const { data } = await request<{ data: string }>('/api/emails/attachment', {
      method: 'POST',
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
    const result = await request<{ messageId?: string; threadId?: string }>('/api/emails/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyEmailsUpdated();
    return result;
  },

  // ---- Drafts (autosaved to Gmail; DB stores preview only) ----

  async listDrafts(): Promise<RemoteDraft[]> {
    const { drafts } = await request<{ drafts: RemoteDraft[] }>('/api/drafts');
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
    const result = await request<{ draftId: string; gmailDraftId: string }>('/api/drafts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    notifyEmailsUpdated();
    return result;
  },

  async deleteDraft(draftId: string): Promise<void> {
    await request(`/api/drafts?id=${encodeURIComponent(draftId)}`, { method: 'DELETE' });
    notifyEmailsUpdated();
  },

  // ---- Accounts ----

  async listAccounts(): Promise<ConnectedAccount[]> {
    const { accounts } = await request<{ accounts: ConnectedAccount[] }>('/api/accounts');
    return accounts;
  },

  async disconnectAccount(accountId: string): Promise<void> {
    await request(`/api/accounts?id=${encodeURIComponent(accountId)}`, { method: 'DELETE' });
    notifyEmailsUpdated();
  },

  async getGmailConnectUrl(): Promise<string> {
    const { url } = await request<{ url: string }>('/api/auth/gmail');
    return url;
  },
};

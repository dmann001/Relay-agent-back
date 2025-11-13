// Email and Account Types

export interface EmailAccount {
  id: string;
  email: string;
  provider: 'gmail' | 'outlook';
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  connectedAt: string;
}

export interface Email {
  id: string;
  threadId: string;
  from: {
    name: string;
    email: string;
    avatar?: string;
  };
  to: Array<{
    name: string;
    email: string;
  }>;
  cc?: Array<{
    name: string;
    email: string;
  }>;
  subject: string;
  body: string;
  bodyPlain: string;
  date: string;
  read: boolean;
  labels: string[];
  provider: 'gmail' | 'outlook';
  aiSummary?: string;
  aiLabels?: string[];
  hasAttachments?: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

export interface EmailThread {
  id: string;
  subject: string;
  messages: Email[];
  participants: Array<{
    name: string;
    email: string;
    avatar?: string;
  }>;
  lastMessageDate: string;
  aiSummary?: string;
  unreadCount: number;
  labels: string[];
}

export interface Draft {
  id: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
  provider: 'gmail' | 'outlook';
  lastEdited: string;
  aiGenerated?: boolean;
}

export interface AppSettings {
  openaiApiKey?: string;
  aiFeatures: {
    autoSummarize: boolean;
    autoLabel: boolean;
    smartReplies: boolean;
    priorityInbox: boolean;
  };
  theme: 'light' | 'dark' | 'system';
}

export interface LocalStorageData {
  accounts: EmailAccount[];
  emails: Email[];
  drafts: Draft[];
  settings: AppSettings;
  lastSync: string;
}

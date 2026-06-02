// Email and Account Types

export interface EmailAccount {
  id: string;
  email: string;
  provider: 'gmail';
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  connectedAt: string;
}

// Sentiment Analysis Result
export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  emotions?: string[]; // e.g., ['frustrated', 'confused']
}

// Meeting Request extracted from email
export interface MeetingRequest {
  detected: boolean;
  proposedTimes?: string[];
  participants?: string[];
  subject?: string;
  duration?: string;
  location?: string;
}

// Task extracted from email
export interface ExtractedTask {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  sourceEmailId: string;
  createdAt: string;
  completed: boolean;
  completedAt?: string;
}

// Follow-up Reminder
export interface Reminder {
  id: string;
  emailId: string;
  threadId?: string;
  reminderDate: string;
  reason: string;
  type: 'no_reply' | 'follow_up' | 'deadline' | 'custom';
  active: boolean;
  createdAt: string;
  snoozedUntil?: string;
}

// Smart Filter (natural language based)
export interface SmartFilter {
  id: string;
  name: string;
  naturalLanguageQuery: string; // e.g., "emails from my manager about project updates"
  parsedRules: FilterRule[];
  action: FilterAction;
  enabled: boolean;
  createdAt: string;
  matchCount: number;
}

export interface FilterRule {
  field: 'from' | 'to' | 'subject' | 'body' | 'label' | 'date' | 'hasAttachment';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'before' | 'after';
  value: string;
}

export interface FilterAction {
  type: 'label' | 'archive' | 'star' | 'markRead' | 'delete' | 'move';
  value?: string; // e.g., label name or folder name
}

// Auto-Archive Rule
export interface ArchiveRule {
  id: string;
  name: string;
  conditions: {
    olderThanDays?: number;
    fromSenders?: string[];
    hasLabels?: string[];
    isRead?: boolean;
    excludeStarred?: boolean;
  };
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  archivedCount: number;
}

// Usage Statistics for AI features
export interface AgentUsageStats {
  totalEmailsProcessed: number;
  smartRepliesGenerated: number;
  emailsSummarized: number;
  emailsCategorized: number;
  tasksExtracted: number;
  meetingsDetected: number;
  sentimentAnalyzed: number;
  filtersApplied: number;
  emailsArchived: number;
  bulkActionsPerformed: number;
  estimatedTimeSavedMinutes: number;
  lastUpdated: string;
  // Per-day tracking for analytics
  dailyStats: Record<string, {
    date: string;
    emailsProcessed: number;
    aiCalls: number;
    timeSavedMinutes: number;
  }>;
}

// Reply Suggestion
export interface ReplySuggestion {
  id: string;
  emailId: string;
  suggestions: Array<{
    type: 'short' | 'medium' | 'detailed';
    content: string;
    tone: string;
  }>;
  generatedAt: string;
  cached: boolean;
}

// Custom Category for auto-categorization
export interface CustomCategory {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  fromDomains?: string[];
  description?: string;
  emailCount: number;
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
  provider: 'gmail';
  messageId?: string;
  gmailCategory?: 'primary' | 'promotions' | 'social' | 'updates' | 'forums';
  aiSummary?: string;
  aiLabels?: string[];
  hasAttachments?: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId?: string;
    data?: string;
  }>;
  // New AI-powered fields
  sentiment?: SentimentResult;
  priorityScore?: number; // 0-100
  meetingRequest?: MeetingRequest;
  extractedTasks?: string[]; // Task IDs
  isArchived?: boolean;
  archivedAt?: string;
  customCategory?: string;
  replySuggestionsCached?: boolean;
  // Relayed Mode fields
  intent?: EmailIntent;
  lastInteraction?: string; // ISO date of last user interaction with this email
  requiresResponse?: boolean;
  responseDeadline?: string;
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
  provider: 'gmail';
  lastEdited: string;
  aiGenerated?: boolean;
}

// Email Intent for Relayed Mode organization
export type EmailIntent = 
  | 'decision'      // Approvals, choices needed
  | 'info_request'  // Questions to answer  
  | 'meeting'       // Scheduling needs
  | 'action_item'   // Tasks to complete
  | 'update'        // FYI items
  | 'relationship'  // Networking, follow-ups
  | 'unknown';

export interface AppSettings {
  openaiApiKey?: string;
  // Persistent user context for AI features (tone, preferences, role, etc.)
  userContext?: string;
  aiFeatures: {
    autoSummarize: boolean;
    autoLabel: boolean;
    smartReplies: boolean;
    priorityInbox: boolean;
    // New agent feature toggles
    sentimentAnalysis: boolean;
    taskExtraction: boolean;
    meetingDetection: boolean;
    autoArchive: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  // Relayed Mode - AI-powered conversational interface
  relayedMode: boolean;
  // Agent configuration
  agentConfig: {
    priorityThreshold: number; // 0-100, emails above this are "priority"
    archiveAfterDays: number;
    maxReplySuggestions: number;
    preferredLanguage: string;
    customCategories: CustomCategory[];
    vipSenders: string[]; // Important contacts for priority
  };
}

export interface AppStorageData {
  accounts: EmailAccount[];
  emails: Email[];
  drafts: Draft[];
  settings: AppSettings;
  lastSync: string;
  paginationTokens?: Record<string, string | undefined>; // Store pagination tokens per account
  // Agent data
  agentMemory?: AgentMemory;
  tasks: ExtractedTask[];
  reminders: Reminder[];
  smartFilters: SmartFilter[];
  archiveRules: ArchiveRule[];
  replySuggestions: Record<string, ReplySuggestion>; // emailId -> suggestions
  usageStats: AgentUsageStats;
}

export interface AgentMemory {
  summary: string;
  recentCommands: string[];
  lastUpdated: string;
}

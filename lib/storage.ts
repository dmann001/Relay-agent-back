// Local Storage utilities for client-side data persistence
import { 
  EmailAccount, 
  Email, 
  Draft, 
  AppSettings, 
  LocalStorageData,
  ExtractedTask,
  Reminder,
  SmartFilter,
  ArchiveRule,
  ReplySuggestion,
  AgentUsageStats,
  AgentMemory
} from '@/types';

const STORAGE_KEY = 'relay_email_data';

// Default usage stats
const defaultUsageStats: AgentUsageStats = {
  totalEmailsProcessed: 0,
  smartRepliesGenerated: 0,
  emailsSummarized: 0,
  emailsCategorized: 0,
  tasksExtracted: 0,
  meetingsDetected: 0,
  sentimentAnalyzed: 0,
  filtersApplied: 0,
  emailsArchived: 0,
  bulkActionsPerformed: 0,
  estimatedTimeSavedMinutes: 0,
  lastUpdated: new Date().toISOString(),
  dailyStats: {},
};

export const storage = {
  // Get all data
  getData(): LocalStorageData | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      // Ensure new fields exist (migration for existing users)
      return {
        ...parsed,
        agentMemory: parsed.agentMemory || {
          summary: parsed.settings?.userContext || '',
          recentCommands: [],
          lastUpdated: new Date().toISOString(),
        },
        tasks: parsed.tasks || [],
        reminders: parsed.reminders || [],
        smartFilters: parsed.smartFilters || [],
        archiveRules: parsed.archiveRules || [],
        replySuggestions: parsed.replySuggestions || {},
        usageStats: parsed.usageStats || { ...defaultUsageStats },
        settings: {
          ...parsed.settings,
          userContext: parsed.settings?.userContext ?? '',
          aiFeatures: {
            autoSummarize: parsed.settings?.aiFeatures?.autoSummarize ?? true,
            autoLabel: parsed.settings?.aiFeatures?.autoLabel ?? true,
            smartReplies: parsed.settings?.aiFeatures?.smartReplies ?? true,
            priorityInbox: parsed.settings?.aiFeatures?.priorityInbox ?? false,
            sentimentAnalysis: parsed.settings?.aiFeatures?.sentimentAnalysis ?? true,
            taskExtraction: parsed.settings?.aiFeatures?.taskExtraction ?? true,
            meetingDetection: parsed.settings?.aiFeatures?.meetingDetection ?? true,
            autoArchive: parsed.settings?.aiFeatures?.autoArchive ?? false,
          },
          relayedMode: parsed.settings?.relayedMode ?? false,
          agentConfig: {
            priorityThreshold: parsed.settings?.agentConfig?.priorityThreshold ?? 70,
            archiveAfterDays: parsed.settings?.agentConfig?.archiveAfterDays ?? 30,
            maxReplySuggestions: parsed.settings?.agentConfig?.maxReplySuggestions ?? 3,
            preferredLanguage: parsed.settings?.agentConfig?.preferredLanguage ?? 'en',
            customCategories: parsed.settings?.agentConfig?.customCategories ?? [],
            vipSenders: parsed.settings?.agentConfig?.vipSenders ?? [],
          },
        },
      };
    } catch (error) {
      console.error('Failed to parse storage data:', error);
      return null;
    }
  },

  // Initialize storage with default values
  init(): LocalStorageData {
    const defaultData: LocalStorageData = {
      accounts: [],
      emails: [],
      drafts: [],
      settings: {
        userContext: '',
        aiFeatures: {
          autoSummarize: true,
          autoLabel: true,
          smartReplies: true,
          priorityInbox: false,
          sentimentAnalysis: true,
          taskExtraction: true,
          meetingDetection: true,
          autoArchive: false,
        },
        theme: 'system',
        relayedMode: false,
        agentConfig: {
          priorityThreshold: 70,
          archiveAfterDays: 30,
          maxReplySuggestions: 3,
          preferredLanguage: 'en',
          customCategories: [],
          vipSenders: [],
        },
      },
      lastSync: new Date().toISOString(),
      paginationTokens: {},
      agentMemory: {
        summary: '',
        recentCommands: [],
        lastUpdated: new Date().toISOString(),
      },
      tasks: [],
      reminders: [],
      smartFilters: [],
      archiveRules: [],
      replySuggestions: {},
      usageStats: { ...defaultUsageStats },
    };
    this.setData(defaultData);
    return defaultData;
  },

  // Set all data
  setData(data: LocalStorageData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('relay-storage-updated'));
  },

  // Account methods
  getAccounts(): EmailAccount[] {
    const data = this.getData();
    const accounts = data?.accounts || [];
    if (accounts.length <= 1) return accounts;

    const seenIds = new Set<string>();
    const deduped: EmailAccount[] = [];
    let changed = false;

    for (const account of accounts) {
      if (seenIds.has(account.id)) {
        changed = true;
        continue;
      }
      seenIds.add(account.id);
      deduped.push(account);
    }

    if (changed && data) {
      data.accounts = deduped;
      this.setData(data);
    }

    return deduped;
  },

  addAccount(account: EmailAccount): void {
    const data = this.getData() || this.init();
    const index = data.accounts.findIndex((a) => a.id === account.id);
    if (index !== -1) {
      data.accounts[index] = { ...data.accounts[index], ...account };
    } else {
      data.accounts.push(account);
    }
    this.setData(data);
  },

  updateAccount(accountId: string, updates: Partial<EmailAccount>): void {
    const data = this.getData() || this.init();
    const index = data.accounts.findIndex((a) => a.id === accountId);
    if (index !== -1) {
      data.accounts[index] = { ...data.accounts[index], ...updates };
      this.setData(data);
    }
  },

  removeAccount(accountId: string): void {
    const data = this.getData() || this.init();
    data.accounts = data.accounts.filter((a) => a.id !== accountId);
    // Also remove emails from this account
    data.emails = data.emails.filter((e) => {
      const account = data.accounts.find((a) => a.email === e.from.email);
      return account?.id !== accountId;
    });
    this.setData(data);
  },

  // Email methods
  getEmails(): Email[] {
    const data = this.getData();
    return data?.emails || [];
  },

  addEmails(emails: Email[]): void {
    const data = this.getData() || this.init();
    // Avoid duplicates but update existing emails with fresh data
    if (!Array.isArray(emails)) {
      console.error('addEmails expected an array but got:', emails);
      return;
    }
    const existingEmailsMap = new Map(data.emails.map((e) => [e.id, e]));
    const updatedEmails: Email[] = [];
    
    for (const email of emails) {
      if (existingEmailsMap.has(email.id)) {
        // Update existing email with fresh data (important for re-parsing with new logic)
        const existingEmail = existingEmailsMap.get(email.id)!;
        updatedEmails.push({
          ...existingEmail,
          ...email, // Overwrite with fresh data (body, bodyPlain, attachments, etc.)
        });
      } else {
        // New email
        updatedEmails.push(email);
      }
    }
    
    // Keep emails that weren't in the update batch
    const updatedIds = new Set(emails.map((e) => e.id));
    const otherEmails = data.emails.filter((e) => !updatedIds.has(e.id));
    
    // Combine and sort by date (newest first) - ensures proper order after merging
    data.emails = [...otherEmails, ...updatedEmails].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    data.lastSync = new Date().toISOString();
    this.setData(data);
  },

  updateEmail(emailId: string, updates: Partial<Email>): void {
    const data = this.getData() || this.init();
    const index = data.emails.findIndex((e) => e.id === emailId);
    if (index !== -1) {
      data.emails[index] = { ...data.emails[index], ...updates };
      this.setData(data);
    }
  },

  // Draft methods
  getDrafts(): Draft[] {
    const data = this.getData();
    return data?.drafts || [];
  },

  addDraft(draft: Draft): void {
    const data = this.getData() || this.init();
    data.drafts.push(draft);
    this.setData(data);
  },

  updateDraft(draftId: string, updates: Partial<Draft>): void {
    const data = this.getData() || this.init();
    const index = data.drafts.findIndex((d) => d.id === draftId);
    if (index !== -1) {
      data.drafts[index] = { ...data.drafts[index], ...updates };
      this.setData(data);
    }
  },

  removeDraft(draftId: string): void {
    const data = this.getData() || this.init();
    data.drafts = data.drafts.filter((d) => d.id !== draftId);
    this.setData(data);
  },

  // Settings methods
  getSettings(): AppSettings {
    const data = this.getData();
    return data?.settings || this.init().settings;
  },

  updateSettings(updates: Partial<AppSettings>): void {
    const data = this.getData() || this.init();
    data.settings = { ...data.settings, ...updates };
    this.setData(data);
  },

  // Agent memory
  getAgentMemory(): AgentMemory {
    const data = this.getData();
    return data?.agentMemory || {
      summary: '',
      recentCommands: [],
      lastUpdated: new Date().toISOString(),
    };
  },

  updateAgentMemory(updates: Partial<AgentMemory>): void {
    const data = this.getData() || this.init();
    const current = data.agentMemory || this.getAgentMemory();
    data.agentMemory = { ...current, ...updates, lastUpdated: new Date().toISOString() };
    this.setData(data);
  },

  recordAgentCommand(command: string, limit: number = 8): void {
    const memory = this.getAgentMemory();
    const recent = [command, ...memory.recentCommands.filter((c) => c !== command)].slice(0, limit);
    this.updateAgentMemory({ recentCommands: recent });
  },

  // Pagination token methods
  getPaginationTokens(): Record<string, string | undefined> {
    const data = this.getData();
    return data?.paginationTokens || {};
  },

  setPaginationTokens(tokens: Record<string, string | undefined>): void {
    const data = this.getData() || this.init();
    data.paginationTokens = tokens;
    this.setData(data);
  },

  updatePaginationToken(accountId: string, token: string | undefined): void {
    const data = this.getData() || this.init();
    if (!data.paginationTokens) {
      data.paginationTokens = {};
    }
    data.paginationTokens[accountId] = token;
    this.setData(data);
  },

  // Clear all data
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },

  // Clear only emails (useful for fresh sync without losing settings/accounts)
  clearEmails(): void {
    const data = this.getData() || this.init();
    data.emails = [];
    data.paginationTokens = {};
    data.lastSync = new Date().toISOString();
    this.setData(data);
  },

  // ============================================
  // AGENT DATA METHODS
  // ============================================

  // Task methods
  getTasks(): ExtractedTask[] {
    const data = this.getData();
    return data?.tasks || [];
  },

  addTask(task: ExtractedTask): void {
    const data = this.getData() || this.init();
    data.tasks.push(task);
    this.setData(data);
    this.incrementUsageStat('tasksExtracted', 1);
  },

  updateTask(taskId: string, updates: Partial<ExtractedTask>): void {
    const data = this.getData() || this.init();
    const index = data.tasks.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      data.tasks[index] = { ...data.tasks[index], ...updates };
      this.setData(data);
    }
  },

  removeTask(taskId: string): void {
    const data = this.getData() || this.init();
    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    this.setData(data);
  },

  getTasksByEmail(emailId: string): ExtractedTask[] {
    const data = this.getData();
    return data?.tasks.filter((t) => t.sourceEmailId === emailId) || [];
  },

  // Reminder methods
  getReminders(): Reminder[] {
    const data = this.getData();
    return data?.reminders || [];
  },

  getActiveReminders(): Reminder[] {
    const data = this.getData();
    const now = new Date().toISOString();
    return data?.reminders.filter((r) => 
      r.active && 
      r.reminderDate <= now &&
      (!r.snoozedUntil || r.snoozedUntil <= now)
    ) || [];
  },

  addReminder(reminder: Reminder): void {
    const data = this.getData() || this.init();
    data.reminders.push(reminder);
    this.setData(data);
  },

  updateReminder(reminderId: string, updates: Partial<Reminder>): void {
    const data = this.getData() || this.init();
    const index = data.reminders.findIndex((r) => r.id === reminderId);
    if (index !== -1) {
      data.reminders[index] = { ...data.reminders[index], ...updates };
      this.setData(data);
    }
  },

  removeReminder(reminderId: string): void {
    const data = this.getData() || this.init();
    data.reminders = data.reminders.filter((r) => r.id !== reminderId);
    this.setData(data);
  },

  snoozeReminder(reminderId: string, snoozedUntil: string): void {
    this.updateReminder(reminderId, { snoozedUntil });
  },

  // Smart Filter methods
  getSmartFilters(): SmartFilter[] {
    const data = this.getData();
    return data?.smartFilters || [];
  },

  addSmartFilter(filter: SmartFilter): void {
    const data = this.getData() || this.init();
    data.smartFilters.push(filter);
    this.setData(data);
  },

  updateSmartFilter(filterId: string, updates: Partial<SmartFilter>): void {
    const data = this.getData() || this.init();
    const index = data.smartFilters.findIndex((f) => f.id === filterId);
    if (index !== -1) {
      data.smartFilters[index] = { ...data.smartFilters[index], ...updates };
      this.setData(data);
    }
  },

  removeSmartFilter(filterId: string): void {
    const data = this.getData() || this.init();
    data.smartFilters = data.smartFilters.filter((f) => f.id !== filterId);
    this.setData(data);
  },

  incrementFilterMatchCount(filterId: string): void {
    const data = this.getData() || this.init();
    const index = data.smartFilters.findIndex((f) => f.id === filterId);
    if (index !== -1) {
      data.smartFilters[index].matchCount++;
      this.setData(data);
      this.incrementUsageStat('filtersApplied', 1);
    }
  },

  // Archive Rule methods
  getArchiveRules(): ArchiveRule[] {
    const data = this.getData();
    return data?.archiveRules || [];
  },

  addArchiveRule(rule: ArchiveRule): void {
    const data = this.getData() || this.init();
    data.archiveRules.push(rule);
    this.setData(data);
  },

  updateArchiveRule(ruleId: string, updates: Partial<ArchiveRule>): void {
    const data = this.getData() || this.init();
    const index = data.archiveRules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      data.archiveRules[index] = { ...data.archiveRules[index], ...updates };
      this.setData(data);
    }
  },

  removeArchiveRule(ruleId: string): void {
    const data = this.getData() || this.init();
    data.archiveRules = data.archiveRules.filter((r) => r.id !== ruleId);
    this.setData(data);
  },

  // Reply Suggestions (cached)
  getReplySuggestions(emailId: string): ReplySuggestion | null {
    const data = this.getData();
    return data?.replySuggestions[emailId] || null;
  },

  saveReplySuggestions(emailId: string, suggestion: ReplySuggestion): void {
    const data = this.getData() || this.init();
    data.replySuggestions[emailId] = suggestion;
    this.setData(data);
    this.incrementUsageStat('smartRepliesGenerated', 1);
  },

  clearReplySuggestions(emailId: string): void {
    const data = this.getData() || this.init();
    delete data.replySuggestions[emailId];
    this.setData(data);
  },

  // Usage Statistics
  getUsageStats(): AgentUsageStats {
    const data = this.getData();
    return data?.usageStats || { ...defaultUsageStats };
  },

  incrementUsageStat(
    stat: keyof Omit<AgentUsageStats, 'lastUpdated' | 'dailyStats'>,
    amount: number = 1,
    timeSavedMinutes: number = 0
  ): void {
    const data = this.getData() || this.init();
    if (typeof data.usageStats[stat] === 'number') {
      (data.usageStats[stat] as number) += amount;
    }
    data.usageStats.estimatedTimeSavedMinutes += timeSavedMinutes;
    data.usageStats.lastUpdated = new Date().toISOString();

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!data.usageStats.dailyStats[today]) {
      data.usageStats.dailyStats[today] = {
        date: today,
        emailsProcessed: 0,
        aiCalls: 0,
        timeSavedMinutes: 0,
      };
    }
    data.usageStats.dailyStats[today].aiCalls += 1;
    data.usageStats.dailyStats[today].timeSavedMinutes += timeSavedMinutes;

    this.setData(data);
  },

  recordEmailProcessed(): void {
    const data = this.getData() || this.init();
    data.usageStats.totalEmailsProcessed += 1;
    data.usageStats.lastUpdated = new Date().toISOString();

    const today = new Date().toISOString().split('T')[0];
    if (!data.usageStats.dailyStats[today]) {
      data.usageStats.dailyStats[today] = {
        date: today,
        emailsProcessed: 0,
        aiCalls: 0,
        timeSavedMinutes: 0,
      };
    }
    data.usageStats.dailyStats[today].emailsProcessed += 1;

    this.setData(data);
  },

  // Archive email
  archiveEmail(emailId: string): void {
    const data = this.getData() || this.init();
    const index = data.emails.findIndex((e) => e.id === emailId);
    if (index !== -1) {
      data.emails[index].isArchived = true;
      data.emails[index].archivedAt = new Date().toISOString();
      this.setData(data);
      this.incrementUsageStat('emailsArchived', 1, 0.5);
    }
  },

  unarchiveEmail(emailId: string): void {
    const data = this.getData() || this.init();
    const index = data.emails.findIndex((e) => e.id === emailId);
    if (index !== -1) {
      data.emails[index].isArchived = false;
      data.emails[index].archivedAt = undefined;
      this.setData(data);
    }
  },

  getArchivedEmails(): Email[] {
    const data = this.getData();
    return data?.emails.filter((e) => e.isArchived) || [];
  },

  getNonArchivedEmails(): Email[] {
    const data = this.getData();
    return data?.emails.filter((e) => !e.isArchived) || [];
  },

  getSentEmails(): Email[] {
    const data = this.getData();
    return data?.emails.filter((e) => e.labels.includes('SENT')) || [];
  },

  // Bulk operations
  bulkArchiveEmails(emailIds: string[]): void {
    const data = this.getData() || this.init();
    const now = new Date().toISOString();
    let count = 0;
    for (const id of emailIds) {
      const index = data.emails.findIndex((e) => e.id === id);
      if (index !== -1 && !data.emails[index].isArchived) {
        data.emails[index].isArchived = true;
        data.emails[index].archivedAt = now;
        count++;
      }
    }
    this.setData(data);
    if (count > 0) {
      this.incrementUsageStat('emailsArchived', count, count * 0.5);
      this.incrementUsageStat('bulkActionsPerformed', 1, 0);
    }
  },

  bulkMarkRead(emailIds: string[], read: boolean): void {
    const data = this.getData() || this.init();
    for (const id of emailIds) {
      const index = data.emails.findIndex((e) => e.id === id);
      if (index !== -1) {
        data.emails[index].read = read;
      }
    }
    this.setData(data);
    this.incrementUsageStat('bulkActionsPerformed', 1, emailIds.length * 0.1);
  },

  bulkAddLabel(emailIds: string[], label: string): void {
    const data = this.getData() || this.init();
    for (const id of emailIds) {
      const index = data.emails.findIndex((e) => e.id === id);
      if (index !== -1 && !data.emails[index].labels.includes(label)) {
        data.emails[index].labels.push(label);
      }
    }
    this.setData(data);
    this.incrementUsageStat('bulkActionsPerformed', 1, emailIds.length * 0.1);
  },

  bulkRemoveLabel(emailIds: string[], label: string): void {
    const data = this.getData() || this.init();
    for (const id of emailIds) {
      const index = data.emails.findIndex((e) => e.id === id);
      if (index !== -1) {
        data.emails[index].labels = data.emails[index].labels.filter((l) => l !== label);
      }
    }
    this.setData(data);
    this.incrementUsageStat('bulkActionsPerformed', 1, emailIds.length * 0.1);
  },

  // ============================================
  // RELAYED MODE METHODS
  // ============================================

  // Get/Set relayed mode
  isRelayedMode(): boolean {
    const settings = this.getSettings();
    return settings?.relayedMode ?? false;
  },

  setRelayedMode(enabled: boolean): void {
    this.updateSettings({ relayedMode: enabled });
  },

  toggleRelayedMode(): boolean {
    const current = this.isRelayedMode();
    this.setRelayedMode(!current);
    return !current;
  },

  // VIP Senders
  getVipSenders(): string[] {
    const settings = this.getSettings();
    return settings?.agentConfig?.vipSenders || [];
  },

  addVipSender(email: string): void {
    const settings = this.getSettings();
    const vipSenders = settings?.agentConfig?.vipSenders || [];
    if (!vipSenders.includes(email.toLowerCase())) {
      this.updateSettings({
        agentConfig: {
          ...settings.agentConfig,
          vipSenders: [...vipSenders, email.toLowerCase()],
        },
      });
    }
  },

  removeVipSender(email: string): void {
    const settings = this.getSettings();
    const vipSenders = settings?.agentConfig?.vipSenders || [];
    this.updateSettings({
      agentConfig: {
        ...settings.agentConfig,
        vipSenders: vipSenders.filter((e) => e !== email.toLowerCase()),
      },
    });
  },

  isVipSender(email: string): boolean {
    const vipSenders = this.getVipSenders();
    return vipSenders.includes(email.toLowerCase());
  },

  // Get emails by intent for Relayed Mode
  getEmailsByIntent(intent: string): Email[] {
    const emails = this.getNonArchivedEmails();
    return emails.filter((e) => e.intent === intent);
  },

  // Get emails requiring response
  getEmailsRequiringResponse(): Email[] {
    const emails = this.getNonArchivedEmails();
    return emails.filter((e) => e.requiresResponse);
  },

  // Get emails from VIP senders
  getVipEmails(): Email[] {
    const emails = this.getNonArchivedEmails();
    const vipSenders = this.getVipSenders();
    return emails.filter((e) => vipSenders.includes(e.from.email.toLowerCase()));
  },

  // Update email intent
  updateEmailIntent(emailId: string, intent: string): void {
    this.updateEmail(emailId, { intent: intent as any });
  },

  // Record interaction with email
  recordEmailInteraction(emailId: string): void {
    this.updateEmail(emailId, { lastInteraction: new Date().toISOString() });
  },

  // Get stale conversations (no interaction in X days)
  getStaleConversations(daysThreshold: number = 7): Email[] {
    const emails = this.getNonArchivedEmails();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysThreshold);
    
    return emails.filter((e) => {
      if (!e.lastInteraction) return true;
      return new Date(e.lastInteraction) < threshold;
    });
  },
};

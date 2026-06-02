import {
  EmailAccount,
  Email,
  Draft,
  AppSettings,
  AppStorageData,
  ExtractedTask,
  Reminder,
  SmartFilter,
  ArchiveRule,
  ReplySuggestion,
  AgentUsageStats,
  AgentMemory,
} from '@/types';
import { supabase } from '@/lib/supabase/client';

type RelayStorageData = AppStorageData & {
  historyIds?: Record<string, string | undefined>;
};

const TABLE_NAME = 'relay_user_data';

const defaultUsageStats = (): AgentUsageStats => ({
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
});

const createDefaultData = (): RelayStorageData => ({
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
  historyIds: {},
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
  usageStats: defaultUsageStats(),
});

const normalizeData = (value?: Partial<RelayStorageData> | null): RelayStorageData => {
  const base = createDefaultData();
  const parsed = value || {};
  const settings = parsed.settings || base.settings;

  return {
    ...base,
    ...parsed,
    accounts: parsed.accounts || [],
    emails: parsed.emails || [],
    drafts: parsed.drafts || [],
    paginationTokens: parsed.paginationTokens || {},
    historyIds: parsed.historyIds || {},
    agentMemory: parsed.agentMemory || {
      summary: settings.userContext || '',
      recentCommands: [],
      lastUpdated: new Date().toISOString(),
    },
    tasks: parsed.tasks || [],
    reminders: parsed.reminders || [],
    smartFilters: parsed.smartFilters || [],
    archiveRules: parsed.archiveRules || [],
    replySuggestions: parsed.replySuggestions || {},
    usageStats: parsed.usageStats || defaultUsageStats(),
    settings: {
      ...base.settings,
      ...settings,
      userContext: settings.userContext ?? '',
      aiFeatures: {
        ...base.settings.aiFeatures,
        ...settings.aiFeatures,
      },
      relayedMode: settings.relayedMode ?? false,
      agentConfig: {
        ...base.settings.agentConfig,
        ...settings.agentConfig,
      },
    },
  };
};

let currentUserId: string | null = null;
let cache: RelayStorageData = createDefaultData();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const dispatchStorageEvent = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('relay-storage-updated'));
};

const persistNow = async () => {
  if (!currentUserId) return;

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert({
      user_id: currentUserId,
      data: cache,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[Storage] Failed to persist Supabase app data:', error);
  }
};

const schedulePersist = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistNow();
  }, 250);
};

const commit = (nextData: RelayStorageData) => {
  cache = normalizeData(nextData);
  schedulePersist();
  dispatchStorageEvent();
};

export const storage = {
  async loadForUser(userId: string): Promise<RelayStorageData> {
    currentUserId = userId;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Storage] Failed to load Supabase app data:', error);
      cache = createDefaultData();
      return cache;
    }

    if (!data?.data) {
      cache = createDefaultData();
      await persistNow();
      dispatchStorageEvent();
      return cache;
    }

    cache = normalizeData(data.data);
    dispatchStorageEvent();
    return cache;
  },

  reset(): void {
    currentUserId = null;
    cache = createDefaultData();
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    dispatchStorageEvent();
  },

  getData(): RelayStorageData | null {
    return cache;
  },

  init(): RelayStorageData {
    commit(createDefaultData());
    return cache;
  },

  setData(data: RelayStorageData): void {
    commit(data);
  },

  getAccounts(): EmailAccount[] {
    const accounts = cache.accounts || [];
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

    if (changed) {
      commit({ ...cache, accounts: deduped });
    }

    return deduped;
  },

  addAccount(account: EmailAccount): void {
    const accounts = [...cache.accounts];
    const index = accounts.findIndex((a) => a.id === account.id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...account };
    } else {
      accounts.push(account);
    }
    commit({ ...cache, accounts });
  },

  updateAccount(accountId: string, updates: Partial<EmailAccount>): void {
    const accounts = cache.accounts.map((account) =>
      account.id === accountId ? { ...account, ...updates } : account
    );
    commit({ ...cache, accounts });
  },

  removeAccount(accountId: string): void {
    const removedAccount = cache.accounts.find((account) => account.id === accountId);
    const accounts = cache.accounts.filter((account) => account.id !== accountId);
    const emails = removedAccount
      ? cache.emails.filter((email) => email.from.email !== removedAccount.email)
      : cache.emails;
    commit({ ...cache, accounts, emails });
  },

  getEmails(): Email[] {
    return cache.emails || [];
  },

  addEmails(emails: Email[]): void {
    if (!Array.isArray(emails)) {
      console.error('addEmails expected an array but got:', emails);
      return;
    }

    const existingEmailsMap = new Map(cache.emails.map((email) => [email.id, email]));
    const updatedEmails: Email[] = [];

    for (const email of emails) {
      updatedEmails.push(existingEmailsMap.has(email.id)
        ? { ...existingEmailsMap.get(email.id)!, ...email }
        : email);
    }

    const updatedIds = new Set(emails.map((email) => email.id));
    const otherEmails = cache.emails.filter((email) => !updatedIds.has(email.id));
    const nextEmails = [...otherEmails, ...updatedEmails].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    commit({ ...cache, emails: nextEmails, lastSync: new Date().toISOString() });
  },

  updateEmail(emailId: string, updates: Partial<Email>): void {
    const emails = cache.emails.map((email) =>
      email.id === emailId ? { ...email, ...updates } : email
    );
    commit({ ...cache, emails });
  },

  getDrafts(): Draft[] {
    return cache.drafts || [];
  },

  addDraft(draft: Draft): void {
    commit({ ...cache, drafts: [...cache.drafts, draft] });
  },

  updateDraft(draftId: string, updates: Partial<Draft>): void {
    const drafts = cache.drafts.map((draft) =>
      draft.id === draftId ? { ...draft, ...updates } : draft
    );
    commit({ ...cache, drafts });
  },

  removeDraft(draftId: string): void {
    commit({ ...cache, drafts: cache.drafts.filter((draft) => draft.id !== draftId) });
  },

  getSettings(): AppSettings {
    return cache.settings;
  },

  updateSettings(updates: Partial<AppSettings>): void {
    commit({
      ...cache,
      settings: {
        ...cache.settings,
        ...updates,
        aiFeatures: updates.aiFeatures
          ? { ...cache.settings.aiFeatures, ...updates.aiFeatures }
          : cache.settings.aiFeatures,
        agentConfig: updates.agentConfig
          ? { ...cache.settings.agentConfig, ...updates.agentConfig }
          : cache.settings.agentConfig,
      },
    });
  },

  getAgentMemory(): AgentMemory {
    return cache.agentMemory || createDefaultData().agentMemory!;
  },

  updateAgentMemory(updates: Partial<AgentMemory>): void {
    commit({
      ...cache,
      agentMemory: {
        ...this.getAgentMemory(),
        ...updates,
        lastUpdated: new Date().toISOString(),
      },
    });
  },

  recordAgentCommand(command: string, limit: number = 8): void {
    const memory = this.getAgentMemory();
    const recentCommands = [command, ...memory.recentCommands.filter((c) => c !== command)].slice(0, limit);
    this.updateAgentMemory({ recentCommands });
  },

  getPaginationTokens(): Record<string, string | undefined> {
    return cache.paginationTokens || {};
  },

  setPaginationTokens(tokens: Record<string, string | undefined>): void {
    commit({ ...cache, paginationTokens: tokens });
  },

  updatePaginationToken(accountId: string, token: string | undefined): void {
    commit({
      ...cache,
      paginationTokens: {
        ...(cache.paginationTokens || {}),
        [accountId]: token,
      },
    });
  },

  getHistoryIds(): Record<string, string | undefined> {
    return cache.historyIds || {};
  },

  setHistoryId(accountId: string, historyId: string | undefined): void {
    commit({
      ...cache,
      historyIds: {
        ...(cache.historyIds || {}),
        [accountId]: historyId,
      },
    });
  },

  getHistoryId(accountId: string): string | undefined {
    return this.getHistoryIds()[accountId];
  },

  async clear(): Promise<void> {
    const previousUserId = currentUserId;
    this.reset();
    if (!previousUserId) return;

    const { error } = await supabase.from(TABLE_NAME).delete().eq('user_id', previousUserId);
    if (error) {
      console.error('[Storage] Failed to clear Supabase app data:', error);
    }
  },

  clearEmails(): void {
    commit({
      ...cache,
      emails: [],
      paginationTokens: {},
      historyIds: {},
      lastSync: new Date().toISOString(),
    });
  },

  getTasks(): ExtractedTask[] {
    return cache.tasks || [];
  },

  addTask(task: ExtractedTask): void {
    commit({ ...cache, tasks: [...cache.tasks, task] });
    this.incrementUsageStat('tasksExtracted', 1);
  },

  updateTask(taskId: string, updates: Partial<ExtractedTask>): void {
    commit({
      ...cache,
      tasks: cache.tasks.map((task) => task.id === taskId ? { ...task, ...updates } : task),
    });
  },

  removeTask(taskId: string): void {
    commit({ ...cache, tasks: cache.tasks.filter((task) => task.id !== taskId) });
  },

  getTasksByEmail(emailId: string): ExtractedTask[] {
    return cache.tasks.filter((task) => task.sourceEmailId === emailId);
  },

  getReminders(): Reminder[] {
    return cache.reminders || [];
  },

  getActiveReminders(): Reminder[] {
    const now = new Date().toISOString();
    return cache.reminders.filter((reminder) =>
      reminder.active &&
      reminder.reminderDate <= now &&
      (!reminder.snoozedUntil || reminder.snoozedUntil <= now)
    );
  },

  addReminder(reminder: Reminder): void {
    commit({ ...cache, reminders: [...cache.reminders, reminder] });
  },

  updateReminder(reminderId: string, updates: Partial<Reminder>): void {
    commit({
      ...cache,
      reminders: cache.reminders.map((reminder) =>
        reminder.id === reminderId ? { ...reminder, ...updates } : reminder
      ),
    });
  },

  removeReminder(reminderId: string): void {
    commit({ ...cache, reminders: cache.reminders.filter((reminder) => reminder.id !== reminderId) });
  },

  snoozeReminder(reminderId: string, snoozedUntil: string): void {
    this.updateReminder(reminderId, { snoozedUntil });
  },

  getSmartFilters(): SmartFilter[] {
    return cache.smartFilters || [];
  },

  addSmartFilter(filter: SmartFilter): void {
    commit({ ...cache, smartFilters: [...cache.smartFilters, filter] });
  },

  updateSmartFilter(filterId: string, updates: Partial<SmartFilter>): void {
    commit({
      ...cache,
      smartFilters: cache.smartFilters.map((filter) =>
        filter.id === filterId ? { ...filter, ...updates } : filter
      ),
    });
  },

  removeSmartFilter(filterId: string): void {
    commit({ ...cache, smartFilters: cache.smartFilters.filter((filter) => filter.id !== filterId) });
  },

  incrementFilterMatchCount(filterId: string): void {
    const smartFilters = cache.smartFilters.map((filter) =>
      filter.id === filterId ? { ...filter, matchCount: filter.matchCount + 1 } : filter
    );
    commit({ ...cache, smartFilters });
    this.incrementUsageStat('filtersApplied', 1);
  },

  getArchiveRules(): ArchiveRule[] {
    return cache.archiveRules || [];
  },

  addArchiveRule(rule: ArchiveRule): void {
    commit({ ...cache, archiveRules: [...cache.archiveRules, rule] });
  },

  updateArchiveRule(ruleId: string, updates: Partial<ArchiveRule>): void {
    commit({
      ...cache,
      archiveRules: cache.archiveRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ),
    });
  },

  removeArchiveRule(ruleId: string): void {
    commit({ ...cache, archiveRules: cache.archiveRules.filter((rule) => rule.id !== ruleId) });
  },

  getReplySuggestions(emailId: string): ReplySuggestion | null {
    return cache.replySuggestions[emailId] || null;
  },

  saveReplySuggestions(emailId: string, suggestion: ReplySuggestion): void {
    commit({
      ...cache,
      replySuggestions: {
        ...cache.replySuggestions,
        [emailId]: suggestion,
      },
    });
    this.incrementUsageStat('smartRepliesGenerated', 1);
  },

  clearReplySuggestions(emailId: string): void {
    const replySuggestions = { ...cache.replySuggestions };
    delete replySuggestions[emailId];
    commit({ ...cache, replySuggestions });
  },

  getUsageStats(): AgentUsageStats {
    return cache.usageStats || defaultUsageStats();
  },

  incrementUsageStat(
    stat: keyof Omit<AgentUsageStats, 'lastUpdated' | 'dailyStats'>,
    amount: number = 1,
    timeSavedMinutes: number = 0
  ): void {
    const usageStats = { ...this.getUsageStats(), dailyStats: { ...this.getUsageStats().dailyStats } };
    if (typeof usageStats[stat] === 'number') {
      (usageStats[stat] as number) += amount;
    }
    usageStats.estimatedTimeSavedMinutes += timeSavedMinutes;
    usageStats.lastUpdated = new Date().toISOString();

    const today = new Date().toISOString().split('T')[0];
    usageStats.dailyStats[today] = usageStats.dailyStats[today] || {
      date: today,
      emailsProcessed: 0,
      aiCalls: 0,
      timeSavedMinutes: 0,
    };
    usageStats.dailyStats[today].aiCalls += 1;
    usageStats.dailyStats[today].timeSavedMinutes += timeSavedMinutes;

    commit({ ...cache, usageStats });
  },

  recordEmailProcessed(): void {
    const usageStats = { ...this.getUsageStats(), dailyStats: { ...this.getUsageStats().dailyStats } };
    usageStats.totalEmailsProcessed += 1;
    usageStats.lastUpdated = new Date().toISOString();

    const today = new Date().toISOString().split('T')[0];
    usageStats.dailyStats[today] = usageStats.dailyStats[today] || {
      date: today,
      emailsProcessed: 0,
      aiCalls: 0,
      timeSavedMinutes: 0,
    };
    usageStats.dailyStats[today].emailsProcessed += 1;

    commit({ ...cache, usageStats });
  },

  archiveEmail(emailId: string): void {
    const emails = cache.emails.map((email) =>
      email.id === emailId
        ? { ...email, isArchived: true, archivedAt: new Date().toISOString() }
        : email
    );
    commit({ ...cache, emails });
    this.incrementUsageStat('emailsArchived', 1, 0.5);
  },

  unarchiveEmail(emailId: string): void {
    const emails = cache.emails.map((email) =>
      email.id === emailId
        ? { ...email, isArchived: false, archivedAt: undefined }
        : email
    );
    commit({ ...cache, emails });
  },

  getArchivedEmails(): Email[] {
    return cache.emails.filter((email) => email.isArchived);
  },

  getNonArchivedEmails(): Email[] {
    return cache.emails.filter((email) => !email.isArchived);
  },

  getSentEmails(): Email[] {
    return cache.emails.filter((email) => email.labels.includes('SENT'));
  },

  bulkArchiveEmails(emailIds: string[]): void {
    const ids = new Set(emailIds);
    const now = new Date().toISOString();
    let count = 0;
    const emails = cache.emails.map((email) => {
      if (!ids.has(email.id) || email.isArchived) return email;
      count++;
      return { ...email, isArchived: true, archivedAt: now };
    });
    commit({ ...cache, emails });
    if (count > 0) {
      this.incrementUsageStat('emailsArchived', count, count * 0.5);
      this.incrementUsageStat('bulkActionsPerformed', 1, 0);
    }
  },

  bulkMarkRead(emailIds: string[], read: boolean): void {
    const ids = new Set(emailIds);
    const emails = cache.emails.map((email) => ids.has(email.id) ? { ...email, read } : email);
    commit({ ...cache, emails });
    this.incrementUsageStat('bulkActionsPerformed', 1, emailIds.length * 0.1);
  },

  bulkAddLabel(emailIds: string[], label: string): void {
    const ids = new Set(emailIds);
    const emails = cache.emails.map((email) =>
      ids.has(email.id) && !email.labels.includes(label)
        ? { ...email, labels: [...email.labels, label] }
        : email
    );
    commit({ ...cache, emails });
    this.incrementUsageStat('bulkActionsPerformed', 1, emailIds.length * 0.1);
  },

  bulkRemoveLabel(emailIds: string[], label: string): void {
    const ids = new Set(emailIds);
    const emails = cache.emails.map((email) =>
      ids.has(email.id)
        ? { ...email, labels: email.labels.filter((currentLabel) => currentLabel !== label) }
        : email
    );
    commit({ ...cache, emails });
    this.incrementUsageStat('bulkActionsPerformed', 1, emailIds.length * 0.1);
  },

  isRelayedMode(): boolean {
    return cache.settings.relayedMode ?? false;
  },

  setRelayedMode(enabled: boolean): void {
    this.updateSettings({ relayedMode: enabled });
  },

  toggleRelayedMode(): boolean {
    const nextMode = !this.isRelayedMode();
    this.setRelayedMode(nextMode);
    return nextMode;
  },

  getVipSenders(): string[] {
    return cache.settings.agentConfig.vipSenders || [];
  },

  addVipSender(email: string): void {
    const normalizedEmail = email.toLowerCase();
    if (this.getVipSenders().includes(normalizedEmail)) return;
    this.updateSettings({
      agentConfig: {
        ...cache.settings.agentConfig,
        vipSenders: [...this.getVipSenders(), normalizedEmail],
      },
    });
  },

  removeVipSender(email: string): void {
    const normalizedEmail = email.toLowerCase();
    this.updateSettings({
      agentConfig: {
        ...cache.settings.agentConfig,
        vipSenders: this.getVipSenders().filter((sender) => sender !== normalizedEmail),
      },
    });
  },

  isVipSender(email: string): boolean {
    return this.getVipSenders().includes(email.toLowerCase());
  },

  getEmailsByIntent(intent: string): Email[] {
    return this.getNonArchivedEmails().filter((email) => email.intent === intent);
  },

  getEmailsRequiringResponse(): Email[] {
    return this.getNonArchivedEmails().filter((email) => email.requiresResponse);
  },

  getVipEmails(): Email[] {
    const vipSenders = this.getVipSenders();
    return this.getNonArchivedEmails().filter((email) => vipSenders.includes(email.from.email.toLowerCase()));
  },

  updateEmailIntent(emailId: string, intent: string): void {
    this.updateEmail(emailId, { intent: intent as any });
  },

  recordEmailInteraction(emailId: string): void {
    this.updateEmail(emailId, { lastInteraction: new Date().toISOString() });
  },

  getStaleConversations(daysThreshold: number = 7): Email[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysThreshold);

    return this.getNonArchivedEmails().filter((email) => {
      if (!email.lastInteraction) return true;
      return new Date(email.lastInteraction) < threshold;
    });
  },
};

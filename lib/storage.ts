// Local Storage utilities for client-side data persistence
import { EmailAccount, Email, Draft, AppSettings, LocalStorageData } from '@/types';

const STORAGE_KEY = 'relay_email_data';

export const storage = {
  // Get all data
  getData(): LocalStorageData | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
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
        aiFeatures: {
          autoSummarize: true,
          autoLabel: true,
          smartReplies: true,
          priorityInbox: false,
        },
        theme: 'system',
      },
      lastSync: new Date().toISOString(),
    };
    this.setData(defaultData);
    return defaultData;
  },

  // Set all data
  setData(data: LocalStorageData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  // Account methods
  getAccounts(): EmailAccount[] {
    const data = this.getData();
    return data?.accounts || [];
  },

  addAccount(account: EmailAccount): void {
    const data = this.getData() || this.init();
    data.accounts.push(account);
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
    // Avoid duplicates
    const existingIds = new Set(data.emails.map((e) => e.id));
    const newEmails = emails.filter((e) => !existingIds.has(e.id));
    data.emails = [...data.emails, ...newEmails];
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

  // Clear all data
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};

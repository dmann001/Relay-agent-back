import { Email, SentimentResult, MeetingRequest, FilterRule, EmailIntent } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = {
    ai: {
        summarizeThread: async (emails: Email[]): Promise<string> => {
            const response = await fetch(`${API_BASE}/ai/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });
            if (!response.ok) throw new Error('Failed to summarize thread');
            const data = await response.json();
            return data.summary;
        },

        draftReply: async (email: Email, context?: string, userContext?: string): Promise<string> => {
            const response = await fetch(`${API_BASE}/ai/draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, context, userContext }),
            });
            if (!response.ok) throw new Error('Failed to draft reply');
            const data = await response.json();
            return data.draft;
        },

        classifyEmail: async (email: Email): Promise<string> => {
            const response = await fetch(`${API_BASE}/ai/classify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Failed to classify email');
            const data = await response.json();
            return data.category;
        },

        searchEmails: async (query: string, limit: number = 10): Promise<any[]> => {
            const response = await fetch(`${API_BASE}/ai/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, limit }),
            });
            if (!response.ok) throw new Error('Failed to search emails');
            const data = await response.json();
            return data.results;
        },

        indexEmails: async (emails: Email[]): Promise<void> => {
            await fetch(`${API_BASE}/ai/index`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });
        },

        // ============================================
        // NEW AI AGENT API METHODS
        // ============================================

        /**
         * Generate smart reply suggestions for an email
         */
        suggestReplies: async (
            email: Email,
            userContext?: string
        ): Promise<Array<{ type: 'short' | 'medium' | 'detailed'; content: string; tone: string }>> => {
            const response = await fetch(`${API_BASE}/ai/suggest-replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, userContext }),
            });
            if (!response.ok) throw new Error('Failed to generate reply suggestions');
            const data = await response.json();
            return data.suggestions;
        },

        /**
         * Analyze sentiment of an email
         */
        analyzeSentiment: async (email: Email): Promise<SentimentResult> => {
            const response = await fetch(`${API_BASE}/ai/sentiment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Failed to analyze sentiment');
            const data = await response.json();
            return data.sentiment;
        },

        /**
         * Calculate priority score for an email
         */
        calculatePriority: async (email: Email, senderHistory?: { emailCount: number; replyRate: number }): Promise<number> => {
            const response = await fetch(`${API_BASE}/ai/priority`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senderHistory }),
            });
            if (!response.ok) throw new Error('Failed to calculate priority');
            const data = await response.json();
            return data.priority;
        },

        /**
         * Extract tasks from an email
         */
        extractTasks: async (email: Email): Promise<Array<{ title: string; deadline?: string; priority: 'low' | 'medium' | 'high' }>> => {
            const response = await fetch(`${API_BASE}/ai/extract-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Failed to extract tasks');
            const data = await response.json();
            return data.tasks;
        },

        /**
         * Detect meeting request in an email
         */
        detectMeeting: async (email: Email): Promise<MeetingRequest> => {
            const response = await fetch(`${API_BASE}/ai/detect-meeting`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) throw new Error('Failed to detect meeting');
            const data = await response.json();
            return data.meetingRequest;
        },

        /**
         * Parse natural language into filter rules
         */
        parseFilter: async (query: string): Promise<FilterRule[]> => {
            const response = await fetch(`${API_BASE}/ai/parse-filter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            if (!response.ok) throw new Error('Failed to parse filter');
            const data = await response.json();
            return data.rules;
        },

        /**
         * Get suggested emails to archive
         */
        suggestArchive: async (emails: Email[]): Promise<string[]> => {
            const response = await fetch(`${API_BASE}/ai/suggest-archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });
            if (!response.ok) throw new Error('Failed to suggest archive candidates');
            const data = await response.json();
            return data.candidates;
        },

        /**
         * Batch enrich emails (more efficient than individual calls)
         */
        batchEnrich: async (emails: Email[]): Promise<Record<string, { category: string; sentiment?: SentimentResult; priority?: number }>> => {
            const response = await fetch(`${API_BASE}/ai/batch-enrich`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });
            if (!response.ok) throw new Error('Failed to batch enrich emails');
            const data = await response.json();
            return data.enrichments;
        },

        // ============================================
        // RELAYED MODE API METHODS
        // ============================================

        /**
         * Classify email intent for Relayed Mode
         */
        classifyIntent: async (email: Email, apiKey?: string): Promise<EmailIntent> => {
            const response = await fetch('/api/ai/classify-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, apiKey }),
            });
            if (!response.ok) throw new Error('Failed to classify intent');
            const data = await response.json();
            return data.intent;
        },

        /**
         * Batch classify email intents for Relayed Mode
         */
        batchClassifyIntents: async (
            emails: Email[],
            apiKey?: string
        ): Promise<{ emailId: string; intent: EmailIntent }[]> => {
            const response = await fetch('/api/ai/classify-intent', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails, apiKey }),
            });
            if (!response.ok) throw new Error('Failed to batch classify intents');
            const data = await response.json();
            return data.results;
        },

        /**
         * Process natural language command for Relayed Mode
         */
        processCommand: async (
            command: string,
            emails: Email[],
            userContext?: string,
            apiKey?: string,
            context?: {
                memorySummary?: string;
                recentCommands?: string[];
                inboxSnapshot?: {
                    total: number;
                    unread: number;
                    requiresResponse: number;
                    vipCount: number;
                    intents: Record<string, number>;
                    lastSync?: string;
                };
                topEmails?: Array<{
                    id: string;
                    subject: string;
                    from: string;
                    date: string;
                    intent?: string;
                    priority?: number;
                    snippet?: string;
                }>;
            }
        ): Promise<{ response: string; data?: any }> => {
            const response = await fetch('/api/ai/process-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command,
                    emailCount: emails.length,
                    userContext,
                    apiKey,
                    context
                }),
            });
            if (!response.ok) throw new Error('Failed to process command');
            return await response.json();
        },
    },
};

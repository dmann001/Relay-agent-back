import OpenAI from 'openai';
import { vectorStore } from './vector_store';
import { Email, SentimentResult, MeetingRequest } from '../../types';

// Lazy initialization of OpenAI client
const getOpenAI = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }
    return new OpenAI({ apiKey });
};

// Truncate text to save tokens
const truncateText = (text: string, maxLength: number = 2000): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '... [truncated]';
};

export const aiService = {
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const openai = getOpenAI();
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: truncateText(text, 8000), // embeddings have higher limit
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    },

    async indexEmail(email: Email) {
        const text = `
Subject: ${email.subject}
From: ${email.from.name} <${email.from.email}>
Date: ${email.date}
Body: ${truncateText(email.bodyPlain || email.body, 4000)}
        `.trim();

        const embedding = await this.generateEmbedding(text);
        await vectorStore.saveEmbedding(email.id, embedding, {
            subject: email.subject,
            from: email.from,
            date: email.date,
            threadId: email.threadId
        }, text);
    },

    async searchEmails(query: string, limit: number = 5) {
        const queryEmbedding = await this.generateEmbedding(query);
        const results = await vectorStore.findSimilar(queryEmbedding, limit);
        return results;
    },

    async summarizeThread(emails: Email[]): Promise<string> {
        const threadContent = emails.map(e => `
From: ${e.from.name}
Date: ${e.date}
Body: ${truncateText(e.bodyPlain, 500)}
        `).join('\n---\n');

        const prompt = `Summarize the following email thread concisely. Focus on key decisions, action items, and the current status.

${threadContent}`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
        });

        return completion.choices[0].message.content || 'No summary generated.';
    },

    async draftReply(email: Email, context: string = '', userContext: string = ''): Promise<string> {
        let relevantContext = '';
        if (!context) {
            const searchResults = await this.searchEmails(email.subject + ' ' + truncateText(email.bodyPlain, 200), 3);
            relevantContext = searchResults.map(r => `Subject: ${r.metadata.subject}\nBody: ${truncateText(r.text || '', 300)}`).join('\n\n');
        } else {
            relevantContext = context;
        }

        const prompt = `You are a helpful email assistant. Draft a reply to the following email.

User Context:
${userContext ? userContext : 'None provided.'}
        
Original Email:
From: ${email.from.name}
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 1000)}

Relevant Context from previous emails:
${truncateText(relevantContext, 500)}

Draft a professional and concise reply.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
        });

        return completion.choices[0].message.content || '';
    },

    async classifyEmail(email: Email): Promise<string> {
        const prompt = `Classify the following email into one of these categories: "Work", "Personal", "Newsletter", "Promotion", "Urgent".
        
Email:
From: ${email.from.name}
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 500)}

Return ONLY the category name.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 20,
        });

        return completion.choices[0].message.content?.trim() || 'Unclassified';
    },

    // ============================================
    // NEW AI AGENT FEATURES
    // ============================================

    /**
     * Generate smart reply suggestions (3 options: short, medium, detailed)
     */
    async generateReplySuggestions(
        email: Email,
        userContext: string = ''
    ): Promise<Array<{ type: 'short' | 'medium' | 'detailed'; content: string; tone: string }>> {
        const prompt = `Generate 3 different reply options for this email. Each reply should have a different length and tone.

User Context:
${userContext ? userContext : 'None provided.'}

Email:
From: ${email.from.name}
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 800)}

Respond in this exact JSON format:
[
  {"type": "short", "content": "A brief 1-2 sentence reply", "tone": "polite"},
  {"type": "medium", "content": "A moderate 3-4 sentence reply with more detail", "tone": "professional"},
  {"type": "detailed", "content": "A comprehensive reply addressing all points", "tone": "thorough"}
]

Return ONLY valid JSON, no other text.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 600,
            temperature: 0.7,
        });

        try {
            const response = completion.choices[0].message.content || '[]';
            return JSON.parse(response);
        } catch {
            return [
                { type: 'short', content: 'Thank you for your email. I will get back to you shortly.', tone: 'polite' },
                { type: 'medium', content: 'Thank you for reaching out. I have received your message and will review it carefully. I will respond with more details soon.', tone: 'professional' },
                { type: 'detailed', content: 'Thank you for your detailed email. I appreciate you taking the time to share this information. I will review everything thoroughly and get back to you with a comprehensive response as soon as possible.', tone: 'thorough' }
            ];
        }
    },

    /**
     * Analyze sentiment of an email
     */
    async analyzeSentiment(email: Email): Promise<SentimentResult> {
        const prompt = `Analyze the sentiment and urgency of this email.

Email:
From: ${email.from.name}
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 600)}

Respond in this exact JSON format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "urgency": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0,
  "emotions": ["emotion1", "emotion2"]
}

Return ONLY valid JSON.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100,
            temperature: 0.3,
        });

        try {
            const response = completion.choices[0].message.content || '';
            return JSON.parse(response);
        } catch {
            return { sentiment: 'neutral', urgency: 'low', confidence: 0.5 };
        }
    },

    /**
     * Calculate priority score for an email (0-100)
     */
    async calculatePriority(email: Email, senderHistory?: { emailCount: number; replyRate: number }): Promise<number> {
        const prompt = `Score the priority of this email from 0-100 based on:
- Sender importance
- Subject urgency keywords
- Content importance
- Time sensitivity

Email:
From: ${email.from.name} <${email.from.email}>
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 400)}
${senderHistory ? `Sender has sent ${senderHistory.emailCount} emails, you reply ${senderHistory.replyRate * 100}% of the time.` : ''}

Return ONLY a number from 0-100.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 10,
            temperature: 0.3,
        });

        try {
            const score = parseInt(completion.choices[0].message.content?.trim() || '50');
            return Math.max(0, Math.min(100, score));
        } catch {
            return 50;
        }
    },

    /**
     * Extract tasks/action items from an email
     */
    async extractTasks(email: Email): Promise<Array<{ title: string; deadline?: string; priority: 'low' | 'medium' | 'high' }>> {
        const prompt = `Extract action items and tasks from this email. Look for:
- Direct requests or asks
- Deadlines mentioned
- Action verbs (please, could you, need to, etc.)

Email:
From: ${email.from.name}
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 1000)}

Respond in this exact JSON format:
[
  {"title": "Task description", "deadline": "YYYY-MM-DD or null", "priority": "low|medium|high"}
]

If no tasks found, return empty array []. Return ONLY valid JSON.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 400,
            temperature: 0.3,
        });

        try {
            const response = completion.choices[0].message.content || '[]';
            return JSON.parse(response);
        } catch {
            return [];
        }
    },

    /**
     * Detect meeting requests in an email
     */
    async detectMeetingRequest(email: Email): Promise<MeetingRequest> {
        const prompt = `Analyze if this email contains a meeting request or scheduling discussion.

Email:
From: ${email.from.name}
Subject: ${email.subject}
Body: ${truncateText(email.bodyPlain, 800)}

Respond in this exact JSON format:
{
  "detected": true/false,
  "proposedTimes": ["time1", "time2"] or null,
  "participants": ["email1", "email2"] or null,
  "subject": "meeting topic" or null,
  "duration": "30 mins" or null,
  "location": "location or video link" or null
}

Return ONLY valid JSON.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.3,
        });

        try {
            const response = completion.choices[0].message.content || '';
            return JSON.parse(response);
        } catch {
            return { detected: false };
        }
    },

    /**
     * Parse natural language filter into structured rules
     */
    async parseFilterFromNaturalLanguage(query: string): Promise<Array<{ field: string; operator: string; value: string }>> {
        const prompt = `Convert this natural language email filter into structured rules:

Filter: "${query}"

Available fields: from, to, subject, body, label, date, hasAttachment
Available operators: contains, equals, startsWith, endsWith, before, after

Respond in this exact JSON format:
[
  {"field": "from", "operator": "contains", "value": "example.com"}
]

Return ONLY valid JSON array.`;

        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.3,
        });

        try {
            const response = completion.choices[0].message.content || '[]';
            return JSON.parse(response);
        } catch {
            return [];
        }
    },

    /**
     * Suggest emails for archiving based on content and age
     */
    async suggestArchiveCandidates(emails: Email[]): Promise<string[]> {
        // Simple heuristic + AI combined approach
        const candidates: string[] = [];
        const now = new Date();

        for (const email of emails) {
            const emailDate = new Date(email.date);
            const daysSinceEmail = Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24));

            // Auto-archive criteria without AI (to save tokens):
            // 1. Newsletters older than 7 days
            // 2. Promotions older than 3 days
            // 3. Read emails older than 30 days with no action labels
            if (
                (email.aiLabels?.includes('Newsletter') && daysSinceEmail > 7) ||
                (email.aiLabels?.includes('Promotion') && daysSinceEmail > 3) ||
                (email.read && daysSinceEmail > 30 && !email.aiLabels?.some(l => ['urgent', 'action', 'important'].includes(l.toLowerCase())))
            ) {
                candidates.push(email.id);
            }
        }

        return candidates;
    },

    /**
     * Batch process multiple emails for enrichment (more efficient)
     * This uses a single API call to process multiple emails
     */
    async batchEnrichEmails(emails: Email[]): Promise<Map<string, { category: string; sentiment?: SentimentResult; priority?: number }>> {
        if (emails.length === 0) return new Map();

        // Process in batches of 5 to stay within token limits
        const batchSize = 5;
        const results = new Map<string, { category: string; sentiment?: SentimentResult; priority?: number }>();

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);

            const emailSummaries = batch.map((e, idx) => `
Email ${idx + 1} (ID: ${e.id}):
From: ${e.from.name}
Subject: ${e.subject}
Preview: ${truncateText(e.bodyPlain, 200)}
`).join('\n---\n');

            const prompt = `Analyze these emails and provide category, sentiment, and priority for each.

${emailSummaries}

Respond in this exact JSON format:
{
  "results": [
    {
      "id": "email_id",
      "category": "Work|Personal|Newsletter|Promotion|Urgent",
      "sentiment": "positive|negative|neutral",
      "urgency": "low|medium|high|critical",
      "priority": 0-100
    }
  ]
}

Return ONLY valid JSON.`;

            const openai = getOpenAI();
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 500,
                temperature: 0.3,
            });

            try {
                const response = JSON.parse(completion.choices[0].message.content || '{"results":[]}');
                for (const result of response.results) {
                    results.set(result.id, {
                        category: result.category || 'Unclassified',
                        sentiment: {
                            sentiment: result.sentiment || 'neutral',
                            urgency: result.urgency || 'low',
                            confidence: 0.7,
                        },
                        priority: result.priority || 50,
                    });
                }
            } catch (error) {
                console.error('Error parsing batch enrichment:', error);
                // Fallback: set defaults for this batch
                for (const email of batch) {
                    results.set(email.id, { category: 'Unclassified' });
                }
            }
        }

        return results;
    },
};

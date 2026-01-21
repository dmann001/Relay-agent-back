import express from 'express';
import { aiService } from '../services/ai';

const router = express.Router();

// POST /api/ai/index - Index emails for vector search
router.post('/index', async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails)) {
            return res.status(400).json({ error: 'Emails array is required' });
        }

        // Process in background or batch? For now, await to ensure it works.
        // In production, this should be a background job.
        let count = 0;
        for (const email of emails) {
            await aiService.indexEmail(email);
            count++;
        }

        res.json({ message: `Indexed ${count} emails successfully` });
    } catch (error: any) {
        console.error('Error indexing emails:', error);
        res.status(500).json({ error: error.message || 'Failed to index emails' });
    }
});

// POST /api/ai/search - Semantic search
router.post('/search', async (req, res) => {
    try {
        const { query, limit } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const results = await aiService.searchEmails(query, limit);
        res.json({ results });
    } catch (error: any) {
        console.error('Error searching emails:', error);
        res.status(500).json({ error: error.message || 'Failed to search emails' });
    }
});

// POST /api/ai/summarize - Summarize thread
router.post('/summarize', async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'Emails array is required' });
        }

        const summary = await aiService.summarizeThread(emails);
        res.json({ summary });
    } catch (error: any) {
        console.error('Error summarizing thread:', error);
        res.status(500).json({ error: error.message || 'Failed to summarize thread' });
    }
});

// POST /api/ai/draft - Draft reply
router.post('/draft', async (req, res) => {
    try {
        const { email, context, userContext } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const draft = await aiService.draftReply(email, context, userContext);
        res.json({ draft });
    } catch (error: any) {
        console.error('Error drafting reply:', error);
        res.status(500).json({ error: error.message || 'Failed to draft reply' });
    }
});

// POST /api/ai/classify - Classify email
router.post('/classify', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const category = await aiService.classifyEmail(email);
        res.json({ category });
    } catch (error: any) {
        console.error('Error classifying email:', error);
        res.status(500).json({ error: error.message || 'Failed to classify email' });
    }
});

// ============================================
// NEW AI AGENT ROUTES
// ============================================

// POST /api/ai/suggest-replies - Generate reply suggestions
router.post('/suggest-replies', async (req, res) => {
    try {
        const { email, userContext } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const suggestions = await aiService.generateReplySuggestions(email, userContext);
        res.json({ suggestions });
    } catch (error: any) {
        console.error('Error generating reply suggestions:', error);
        res.status(500).json({ error: error.message || 'Failed to generate reply suggestions' });
    }
});

// POST /api/ai/sentiment - Analyze sentiment
router.post('/sentiment', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const sentiment = await aiService.analyzeSentiment(email);
        res.json({ sentiment });
    } catch (error: any) {
        console.error('Error analyzing sentiment:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze sentiment' });
    }
});

// POST /api/ai/priority - Calculate priority score
router.post('/priority', async (req, res) => {
    try {
        const { email, senderHistory } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const priority = await aiService.calculatePriority(email, senderHistory);
        res.json({ priority });
    } catch (error: any) {
        console.error('Error calculating priority:', error);
        res.status(500).json({ error: error.message || 'Failed to calculate priority' });
    }
});

// POST /api/ai/extract-tasks - Extract tasks from email
router.post('/extract-tasks', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const tasks = await aiService.extractTasks(email);
        res.json({ tasks });
    } catch (error: any) {
        console.error('Error extracting tasks:', error);
        res.status(500).json({ error: error.message || 'Failed to extract tasks' });
    }
});

// POST /api/ai/detect-meeting - Detect meeting request
router.post('/detect-meeting', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email object is required' });
        }

        const meetingRequest = await aiService.detectMeetingRequest(email);
        res.json({ meetingRequest });
    } catch (error: any) {
        console.error('Error detecting meeting:', error);
        res.status(500).json({ error: error.message || 'Failed to detect meeting' });
    }
});

// POST /api/ai/parse-filter - Parse natural language filter
router.post('/parse-filter', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Filter query is required' });
        }

        const rules = await aiService.parseFilterFromNaturalLanguage(query);
        res.json({ rules });
    } catch (error: any) {
        console.error('Error parsing filter:', error);
        res.status(500).json({ error: error.message || 'Failed to parse filter' });
    }
});

// POST /api/ai/suggest-archive - Suggest emails to archive
router.post('/suggest-archive', async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails)) {
            return res.status(400).json({ error: 'Emails array is required' });
        }

        const candidates = await aiService.suggestArchiveCandidates(emails);
        res.json({ candidates });
    } catch (error: any) {
        console.error('Error suggesting archive candidates:', error);
        res.status(500).json({ error: error.message || 'Failed to suggest archive candidates' });
    }
});

// POST /api/ai/batch-enrich - Batch enrich emails (more efficient)
router.post('/batch-enrich', async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails)) {
            return res.status(400).json({ error: 'Emails array is required' });
        }

        const results = await aiService.batchEnrichEmails(emails);
        // Convert Map to object for JSON response
        const enrichments: Record<string, any> = {};
        results.forEach((value, key) => {
            enrichments[key] = value;
        });
        res.json({ enrichments });
    } catch (error: any) {
        console.error('Error batch enriching emails:', error);
        res.status(500).json({ error: error.message || 'Failed to batch enrich emails' });
    }
});

export default router;

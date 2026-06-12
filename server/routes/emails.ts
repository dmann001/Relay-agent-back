import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Helper to parse Gmail message
// Duplicated from lib/gmail.ts for now, ideally shared or moved to a utils file in server
function parseGmailMessage(message: any): any { // Using any for simplicity in migration, should be typed
    try {
        const headers = message.payload?.headers || [];
        const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('from');
        const to = getHeader('to');
        const subject = getHeader('subject');
        const date = getHeader('date');

        // Parse email address and name
        const parseEmailAddress = (str: string) => {
            const match = str.match(/^(.+?)\s*<(.+?)>$/);
            if (match) {
                return { name: match[1].trim().replace(/"/g, ''), email: match[2].trim() };
            }
            return { name: str, email: str };
        };

        const fromParsed = parseEmailAddress(from);

        // Get body - properly extract HTML and plain text separately
        let body = '';
        let bodyPlain = '';
        const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId?: string }> = [];

        const extractBodyParts = (part: any, htmlContent: { value: string }, plainContent: { value: string }) => {
            if (!part) return;

            const mimeType = (part.mimeType || '').toLowerCase();
            
            // Check if this part has a body with data
            if (part.body?.data) {
                try {
                    const content = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    
                    // Check for HTML content (case-insensitive, handle with parameters like "text/html; charset=utf-8")
                    if (mimeType.includes('text/html')) {
                        // Prefer the first HTML part, but if we find a longer one, use that (likely more complete)
                        if (!htmlContent.value || content.length > htmlContent.value.length) {
                            htmlContent.value = content;
                        }
                    } 
                    // Check for plain text content
                    else if (mimeType.includes('text/plain')) {
                        // Prefer the first plain text part, but if we find a longer one, use that
                        if (!plainContent.value || content.length > plainContent.value.length) {
                            plainContent.value = content;
                        }
                    }
                } catch (error) {
                    console.warn('Error decoding part body:', error);
                }
            }

            // Check for attachments (parts with filenames and attachmentId)
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || 'application/octet-stream',
                    size: part.body.size || 0,
                    attachmentId: part.body.attachmentId,
                });
            }

            // Recursively process nested parts (important for multipart/alternative, multipart/mixed, etc.)
            if (part.parts && Array.isArray(part.parts)) {
                for (const subPart of part.parts) {
                    extractBodyParts(subPart, htmlContent, plainContent);
                }
            }
        };

        if (message.payload) {
            const htmlContent = { value: '' };
            const plainContent = { value: '' };
            extractBodyParts(message.payload, htmlContent, plainContent);

            // Prefer HTML over plain text for body
            body = htmlContent.value || plainContent.value;
            bodyPlain = plainContent.value || (htmlContent.value ? htmlContent.value.replace(/<[^>]*>/g, '').trim() : '');
        }

        // Get labels
        const labels = message.labelIds || [];
        const isUnread = labels.includes('UNREAD');

        return {
            id: message.id || '',
            threadId: message.threadId || '',
            from: {
                name: fromParsed.name,
                email: fromParsed.email,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fromParsed.name)}&background=random`,
            },
            to: to.split(',').map((email: string) => {
                const parsed = parseEmailAddress(email.trim());
                return { name: parsed.name, email: parsed.email };
            }),
            subject: subject || '(No Subject)',
            body,
            bodyPlain: bodyPlain || body,
            date: date || new Date().toISOString(),
            read: !isUnread,
            labels: labels.filter((l: string) => !['UNREAD', 'INBOX', 'CATEGORY_PERSONAL'].includes(l)),
            provider: 'gmail',
            hasAttachments: attachments.length > 0,
            attachments: attachments.length > 0 ? attachments : undefined,
        };
    } catch (error) {
        console.error('Error parsing message:', error);
        return null;
    }
}

// POST /api/emails - Fetch emails
router.post('/', async (req, res) => {
    try {
        const { accessToken, maxResults = 50, pageToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmailApi = google.gmail({ version: 'v1', auth: oauth2Client });

        console.log(`Fetching emails for user. MaxResults: ${maxResults}, PageToken: ${pageToken || 'none'}`);

        // Get list of messages
        const response = await gmailApi.users.messages.list({
            userId: 'me',
            maxResults,
            q: 'in:inbox',
            pageToken,
        });

        console.log('Gmail API List Response:', {
            resultSizeEstimate: response.data.resultSizeEstimate,
            messagesCount: response.data.messages?.length || 0,
            nextPageToken: response.data.nextPageToken ? 'present' : 'missing'
        });

        const messages = response.data.messages || [];
        const emails: any[] = [];
        const nextPageToken = response.data.nextPageToken;

        // Fetch details for each message
        // Note: In production, use batch requests or parallel promises with limit
        for (const message of messages.slice(0, maxResults)) {
            try {
                const msgData = await gmailApi.users.messages.get({
                    userId: 'me',
                    id: message.id!,
                    format: 'full',
                });

                const email = parseGmailMessage(msgData.data);
                if (email) {
                    emails.push(email);
                }
            } catch (error) {
                console.error('Error fetching message:', error);
            }
        }

        res.json({ emails, nextPageToken });
    } catch (error: any) {
        console.error('Error fetching emails:', error);

        if (error.message?.includes('Gmail API has not been used') || error.code === 403) {
            return res.status(403).json({
                error: 'Gmail API not enabled',
                message: 'Please enable the Gmail API in your Google Cloud Console.',
                code: 'GMAIL_API_DISABLED'
            });
        }

        if (error.code === 401 || error.message?.includes('invalid_grant')) {
            return res.status(401).json({
                error: 'Authentication expired',
                message: 'Please reconnect your Gmail account in Settings',
                code: 'AUTH_EXPIRED'
            });
        }

        res.status(500).json({ error: error.message || 'Failed to fetch emails' });
    }
});

export default router;

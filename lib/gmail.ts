// Gmail API utilities
import { google } from 'googleapis';
import { Email } from '@/types';

const createOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const getAuthorizedClient = async (
  accessToken: string,
  refreshToken?: string,
  expiryDate?: number
) => {
  const authClient = createOAuthClient();
  authClient.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  });

  let updatedAccessToken = accessToken;
  let updatedExpiryDate = expiryDate;

  if (refreshToken) {
    const accessTokenResponse = await authClient.getAccessToken();
    if (accessTokenResponse?.token) {
      updatedAccessToken = accessTokenResponse.token;
      updatedExpiryDate = authClient.credentials.expiry_date;
    }
  }

  return { authClient, updatedAccessToken, updatedExpiryDate };
};

export const gmail = {
  // Get authorization URL
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const authClient = createOAuthClient();
    return authClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  },

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    const authClient = createOAuthClient();
    const { tokens } = await authClient.getToken(code);
    return tokens;
  },

  // Get user info
  async getUserInfo(accessToken: string) {
    const authClient = createOAuthClient();
    authClient.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
    const { data } = await oauth2.userinfo.get();
    return data;
  },

  // Fetch emails with batch processing for better performance
  async fetchEmails(
    accessToken: string, 
    maxResults: number = 50, 
    pageToken?: string, 
    existingIds?: Set<string>,
    categoryFilter?: {
      primary?: boolean;
      promotions?: boolean;
      social?: boolean;
      updates?: boolean;
      forums?: boolean;
    },
    mailbox: 'inbox' | 'sent' = 'inbox',
    refreshToken?: string,
    expiryDate?: number
  ): Promise<{ emails: Email[], nextPageToken?: string, totalFetched: number, newCount: number, auth?: { accessToken: string; expiryDate?: number } }> {
    const { authClient, updatedAccessToken, updatedExpiryDate } = await getAuthorizedClient(
      accessToken,
      refreshToken,
      expiryDate
    );
    const gmailApi = google.gmail({ version: 'v1', auth: authClient });

    try {
      // Build query based on category filter
      // By default, only show PRIMARY category (excludes promotions, social, updates, forums)
      let query = mailbox === 'sent'
        ? 'in:sent -in:trash'
        : 'in:inbox -in:spam -in:trash';
      
      // Skip category filtering for Sent mailbox
      if (mailbox === 'sent') {
        console.log('[Gmail] Fetching with query:', query);
      }

      // Default to primary only if no filter provided
      const filter = categoryFilter || { primary: true };
      
      // If only primary is selected (default), exclude all other categories
      if (filter.primary && !filter.promotions && !filter.social && !filter.updates && !filter.forums) {
        query += ' category:primary';
      } else {
        // Build query for specific categories
        const categories: string[] = [];
        if (filter.primary) categories.push('category:primary');
        if (filter.promotions) categories.push('category:promotions');
        if (filter.social) categories.push('category:social');
        if (filter.updates) categories.push('category:updates');
        if (filter.forums) categories.push('category:forums');
        
        if (categories.length > 0 && categories.length < 5) {
          // Use OR to combine multiple categories
          query += ` {${categories.join(' ')}}`;
        }
        // If all categories selected, don't add any category filter
      }
      
      if (mailbox !== 'sent') {
        console.log('[Gmail] Fetching with query:', query);
      }

      const response = await gmailApi.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
        pageToken,
      });

      const messages = response.data.messages || [];
      const emails: Email[] = [];
      let newCount = 0;

      // Filter out messages we already have (if existingIds provided)
      const messagesToFetch = existingIds 
        ? messages.filter(m => !existingIds.has(m.id!))
        : messages;

      console.log(`[Gmail] Found ${messages.length} messages, ${messagesToFetch.length} new to fetch`);

      // Fetch message details in parallel batches (5 at a time to avoid rate limits)
      const BATCH_SIZE = 5;
      for (let i = 0; i < messagesToFetch.length; i += BATCH_SIZE) {
        const batch = messagesToFetch.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (message) => {
            const msgData = await gmailApi.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'full',
            });
            return this.parseGmailMessage(msgData.data);
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            emails.push(result.value);
            newCount++;
          } else if (result.status === 'rejected') {
            console.error('[Gmail] Error fetching message:', result.reason);
          }
        }
      }

      // Sort emails by date (newest first)
      emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { 
        emails, 
        nextPageToken: response.data.nextPageToken || undefined,
        totalFetched: messages.length,
        newCount,
        auth: updatedAccessToken !== accessToken || updatedExpiryDate !== expiryDate
          ? { accessToken: updatedAccessToken, expiryDate: updatedExpiryDate }
          : undefined
      };
    } catch (error: any) {
      console.error('[Gmail] Error fetching emails:', error);
      throw error;
    }
  },

  // Quick sync - only check for new emails since last sync
  async quickSync(accessToken: string, lastSyncTime?: string, categoryFilter?: {
    primary?: boolean;
    promotions?: boolean;
    social?: boolean;
    updates?: boolean;
    forums?: boolean;
  }, mailbox: 'inbox' | 'sent' = 'inbox', refreshToken?: string, expiryDate?: number): Promise<{ emails: Email[], hasMore: boolean, auth?: { accessToken: string; expiryDate?: number } }> {
    const { authClient, updatedAccessToken, updatedExpiryDate } = await getAuthorizedClient(
      accessToken,
      refreshToken,
      expiryDate
    );
    const gmailApi = google.gmail({ version: 'v1', auth: authClient });

    try {
      // Build query for new emails - default to primary only
      let query = mailbox === 'sent'
        ? 'in:sent -in:trash'
        : 'in:inbox -in:spam -in:trash';
      
      if (mailbox !== 'sent') {
        const filter = categoryFilter || { primary: true };
        if (filter.primary && !filter.promotions && !filter.social && !filter.updates && !filter.forums) {
          query += ' category:primary';
        } else {
          const categories: string[] = [];
          if (filter.primary) categories.push('category:primary');
          if (filter.promotions) categories.push('category:promotions');
          if (filter.social) categories.push('category:social');
          if (filter.updates) categories.push('category:updates');
          if (filter.forums) categories.push('category:forums');
          
          if (categories.length > 0 && categories.length < 5) {
            query += ` {${categories.join(' ')}}`;
          }
        }
      }
      
      if (lastSyncTime) {
        // Format: after:YYYY/MM/DD
        const date = new Date(lastSyncTime);
        const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        query += ` after:${formattedDate}`;
      }

      console.log('[Gmail] Quick sync query:', query);

      const response = await gmailApi.users.messages.list({
        userId: 'me',
        maxResults: 20, // Only fetch recent emails for quick sync
        q: query,
      });

      const messages = response.data.messages || [];
      const emails: Email[] = [];

      // Fetch in parallel batches
      const BATCH_SIZE = 5;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (message) => {
            const msgData = await gmailApi.users.messages.get({
              userId: 'me',
              id: message.id!,
              format: 'full',
            });
            return this.parseGmailMessage(msgData.data);
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            emails.push(result.value);
          }
        }
      }

      // Sort by date (newest first) using the internalDate we parsed
      emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { 
        emails, 
        hasMore: !!response.data.nextPageToken,
        auth: updatedAccessToken !== accessToken || updatedExpiryDate !== expiryDate
          ? { accessToken: updatedAccessToken, expiryDate: updatedExpiryDate }
          : undefined
      };
    } catch (error) {
      console.error('[Gmail] Error in quick sync:', error);
      throw error;
    }
  },

  // Parse Gmail message to Email format
  parseGmailMessage(message: any): Email | null {
    try {
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('from');
      const to = getHeader('to');
      const subject = getHeader('subject');
      const messageIdHeader = getHeader('message-id');
      const dateHeader = getHeader('date');
      
      // Use internalDate (Gmail's received timestamp) for accurate sorting
      // This is more reliable than the Date header which can be spoofed or incorrect
      const internalDate = message.internalDate;
      const date = internalDate 
        ? new Date(parseInt(internalDate)).toISOString()
        : (dateHeader || new Date().toISOString());

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
      
      // Extract Gmail category from labels
      let gmailCategory: 'primary' | 'promotions' | 'social' | 'updates' | 'forums' | undefined;
      if (labels.includes('CATEGORY_PERSONAL') || labels.includes('CATEGORY_PRIMARY')) {
        gmailCategory = 'primary';
      } else if (labels.includes('CATEGORY_PROMOTIONS')) {
        gmailCategory = 'promotions';
      } else if (labels.includes('CATEGORY_SOCIAL')) {
        gmailCategory = 'social';
      } else if (labels.includes('CATEGORY_UPDATES')) {
        gmailCategory = 'updates';
      } else if (labels.includes('CATEGORY_FORUMS')) {
        gmailCategory = 'forums';
      }

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
        date,  // Uses internalDate (Gmail's received timestamp) for accurate sorting
        read: !isUnread,
        labels: labels.filter((l: string) => !['UNREAD', 'INBOX', 'CATEGORY_PERSONAL', 'CATEGORY_PRIMARY', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'].includes(l)),
        messageId: messageIdHeader?.replace(/[<>]/g, '') || undefined,
        gmailCategory,
        provider: 'gmail',
        hasAttachments: attachments.length > 0,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
    } catch (error) {
      console.error('Error parsing message:', error);
      return null;
    }
  },

  // Send email
  async sendEmail(
    accessToken: string,
    to: string[],
    subject: string,
    body: string,
    cc?: string[],
    threadId?: string,
    inReplyToMessageId?: string,
    attachments?: Array<{ filename: string; mimeType: string; data: string }>,
    refreshToken?: string,
    expiryDate?: number
  ) {
    const { authClient, updatedAccessToken, updatedExpiryDate } = await getAuthorizedClient(
      accessToken,
      refreshToken,
      expiryDate
    );
    const gmailApi = google.gmail({ version: 'v1', auth: authClient });

    // Build email headers
    const headers = [
      `To: ${to.join(', ')}`,
    ];
    
    if (cc && cc.length > 0) {
      headers.push(`Cc: ${cc.join(', ')}`);
    }

    if (inReplyToMessageId) {
      headers.push(`In-Reply-To: <${inReplyToMessageId}>`);
      headers.push(`References: <${inReplyToMessageId}>`);
    }
    
    headers.push(`Subject: ${subject}`);

    const formatBodyAsHtml = (content: string) => {
      const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
      if (hasHtml) return content;
      return content
        .split('\n')
        .map((line) => line.trim() === '' ? '<br />' : line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
        .join('<br />');
    };

    const htmlBody = formatBodyAsHtml(body);

    let message = '';
    if (attachments && attachments.length > 0) {
      const boundary = `==RELAYSPLIT_${Date.now()}==`;
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      message = [
        ...headers,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        htmlBody,
        '',
        ...attachments.flatMap((attachment) => [
          `--${boundary}`,
          `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.data,
          '',
        ]),
        `--${boundary}--`,
      ].join('\n');
    } else {
      headers.push('Content-Type: text/html; charset=utf-8');
      message = [...headers, '', htmlBody].join('\n');
    }

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmailApi.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId,
      },
    });

    return {
      data: response.data,
      auth: updatedAccessToken !== accessToken || updatedExpiryDate !== expiryDate
        ? { accessToken: updatedAccessToken, expiryDate: updatedExpiryDate }
        : undefined,
    };
  },

  // Fetch attachment data
  async getAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string,
    refreshToken?: string,
    expiryDate?: number
  ): Promise<{ data: string; auth?: { accessToken: string; expiryDate?: number } }> {
    const { authClient, updatedAccessToken, updatedExpiryDate } = await getAuthorizedClient(
      accessToken,
      refreshToken,
      expiryDate
    );
    const gmailApi = google.gmail({ version: 'v1', auth: authClient });

    const response = await gmailApi.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    return {
      data: response.data.data || '',
      auth: updatedAccessToken !== accessToken || updatedExpiryDate !== expiryDate
        ? { accessToken: updatedAccessToken, expiryDate: updatedExpiryDate }
        : undefined,
    };
  },
};

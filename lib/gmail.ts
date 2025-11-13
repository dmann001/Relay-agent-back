// Gmail API utilities
import { google } from 'googleapis';
import { Email } from '@/types';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

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

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  },

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  },

  // Set credentials
  setCredentials(accessToken: string, refreshToken?: string, expiryDate?: number) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
    });
  },

  // Get user info
  async getUserInfo(accessToken: string) {
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data;
  },

  // Fetch emails
  async fetchEmails(accessToken: string, maxResults: number = 50): Promise<Email[]> {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmailApi = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      // Get list of messages
      const response = await gmailApi.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox',
      });

      const messages = response.data.messages || [];
      const emails: Email[] = [];

      // Fetch details for each message
      for (const message of messages.slice(0, maxResults)) {
        try {
          const msgData = await gmailApi.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          const email = this.parseGmailMessage(msgData.data);
          if (email) {
            emails.push(email);
          }
        } catch (error) {
          console.error('Error fetching message:', error);
        }
      }

      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error);
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

      // Get body
      let body = '';
      let bodyPlain = '';

      const getBody = (part: any): string => {
        if (part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          for (const subPart of part.parts) {
            if (subPart.mimeType === 'text/html' || subPart.mimeType === 'text/plain') {
              const content = getBody(subPart);
              if (content) return content;
            }
          }
        }
        return '';
      };

      if (message.payload) {
        body = getBody(message.payload);
        bodyPlain = body.replace(/<[^>]*>/g, '').trim();
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
        hasAttachments: false,
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
    threadId?: string
  ) {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmailApi = google.gmail({ version: 'v1', auth: oauth2Client });

    const message = [
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
    ].join('\n');

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

    return response.data;
  },
};

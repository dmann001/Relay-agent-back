# Relay Email Agent - Setup Guide

This guide will help you set up and run the Relay Email Agent with Gmail integration and AI-powered features.

## Features

- **Gmail OAuth Integration** - Securely connect your Gmail account
- **AI-Powered Email Summaries** - Automatic email summarization using GPT
- **Smart Labels** - AI categorizes emails automatically
- **AI Draft Generation** - Generate professional email replies instantly
- **Local Storage** - All data stored locally in your browser
- **Modern UI** - Beautiful, responsive interface built with Next.js and Tailwind CSS

## Prerequisites

1. **Node.js** (v18 or higher)
2. **pnpm** package manager
3. **Google Cloud Project** for Gmail OAuth
4. **OpenAI API Key** for AI features

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Set Up Google OAuth for Gmail

### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Configure:
   - **Name**: Relay Email Agent
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3000/api/auth/gmail/callback`
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

## Step 3: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your credentials:
   ```env
   # Gmail OAuth Configuration
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Session Secret (you can keep the default for local development)
   SESSION_SECRET=relay-email-agent-secret-key-change-this

   # OpenAI API Key (optional - can be set in UI)
   OPENAI_API_KEY=
   ```

## Step 4: Get OpenAI API Key (For AI Features)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy the key (you can also add it later in the app's Settings page)

## Step 5: Run the Application

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Step 6: Connect Your Gmail Account

1. Open the app at `http://localhost:3000`
2. Click on **Settings** in the sidebar
3. In the **Account Management** tab, click **Connect Gmail Account**
4. You'll be redirected to Google's OAuth consent screen
5. Grant the necessary permissions:
   - Read emails
   - Send emails
   - Compose emails
6. After authorization, you'll be redirected back to the app
7. Your Gmail account is now connected!

## Step 7: Configure OpenAI API Key

1. In **Settings** > **Account Management** tab
2. Scroll to **OpenAI API Key** section
3. Paste your OpenAI API key
4. Click **Save API Key**

## Step 8: Enable AI Features

1. Go to **Settings** > **Preferences** tab
2. Toggle on the AI features you want:
   - **AI Summaries** - Automatically generate summaries for emails
   - **Smart Labels** - Automatically categorize emails
   - **Smart Replies** - Enable AI-powered draft generation
   - **Priority Inbox** - Use AI to prioritize important emails

## Using the Application

### Sync Your Emails

1. Go to the **Inbox** page
2. Click the **Sync** button in the top right
3. The app will fetch your latest 20 emails from Gmail
4. If AI features are enabled, emails will be automatically enriched with summaries and labels

### View an Email

1. Click on any email in the inbox
2. View the email content
3. See AI-generated summary (if enabled)
4. See smart labels

### Generate AI Draft Replies

1. Open an email thread
2. Scroll to the **AI-Powered Draft Assistance** section
3. Click one of the suggested actions OR
4. Click **Generate Draft** for a general reply
5. Review and edit the AI-generated draft
6. Click **Save Draft** to save for later
7. Click **Send Reply** to send (coming soon)

### View Saved Drafts

1. Click **Drafts** in the sidebar
2. View all your saved drafts
3. Click on a draft to continue editing

## Architecture Overview

### Frontend
- **Next.js 16** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Local Storage** for data persistence

### Backend (API Routes)
- `/api/auth/gmail` - Start Gmail OAuth flow
- `/api/auth/gmail/callback` - Handle OAuth callback
- `/api/emails` - Fetch emails from Gmail
- `/api/ai/generate-draft` - Generate email drafts with GPT
- `/api/ai/enrich-email` - Generate summaries and labels

### Data Storage
- All data is stored locally in the browser's `localStorage`
- No server-side database required
- Data structure:
  - Email accounts (with OAuth tokens)
  - Emails (with AI enrichments)
  - Drafts
  - Settings (including API keys)

## Security Notes

1. **OAuth Tokens** are stored in browser localStorage - they never leave your machine
2. **OpenAI API Key** is stored locally and only sent to your own backend
3. **Email Data** is fetched directly from Gmail API and stored locally
4. For production use, consider:
   - Using a proper backend database
   - Encrypting sensitive data
   - Implementing token refresh logic
   - Adding proper session management

## Troubleshooting

### OAuth Error: "redirect_uri_mismatch"
- Make sure the redirect URI in Google Cloud Console exactly matches: `http://localhost:3000/api/auth/gmail/callback`
- Check that you're running the app on port 3000

### Emails Not Syncing
- Check that your Gmail account is connected in Settings
- Verify the access token hasn't expired
- Check browser console for errors

### AI Features Not Working
- Ensure you've added a valid OpenAI API key
- Check that AI features are enabled in Settings > Preferences
- Verify you have credits in your OpenAI account

### Build Errors
- Delete `node_modules` and `.next` folders
- Run `pnpm install` again
- Clear browser cache

## Development Commands

```bash
# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Next Steps / Future Enhancements

- [ ] Email sending functionality
- [ ] Outlook/Microsoft integration
- [ ] Advanced email search
- [ ] Email threading improvements
- [ ] Attachment support
- [ ] Calendar integration
- [ ] Desktop notifications
- [ ] Mobile responsive improvements
- [ ] Server-side database option
- [ ] Multi-account management
- [ ] Email templates
- [ ] Scheduled sending

## Support

For issues or questions:
1. Check the browser console for errors
2. Review the setup steps above
3. Check that all environment variables are set correctly

## License

MIT

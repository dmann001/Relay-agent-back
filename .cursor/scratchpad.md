# Relay Email Agent - Project Documentation

## Background and Motivation

**Relay** is an AI-powered email client built with Next.js that provides a unified inbox experience with intelligent email management features. The application integrates with Gmail (and plans for Outlook) to fetch emails, uses OpenAI for AI-powered features like email summarization, smart labeling, and draft generation, and stores all data locally in the browser for privacy.

Recently, we've decided to add a professional, modern landing page (Hero Page) to the application to better communicate its value proposition to new users. This landing page will be inspired by the "Æther" design language, featuring a minimalist dark theme, bold typography, and interactive components that showcase the AI capabilities of the Relay agent.

### Key Features
- **Modern Landing Page** - A beautiful, high-converting hero page with minimalist design
- **Gmail OAuth Integration** - Secure connection to Gmail accounts
- **AI-Powered Email Summaries** - Automatic email summarization using GPT-4o-mini
- **Smart Labels** - AI categorizes emails automatically (urgent, action, followup, meeting, financial, etc.)
- **AI Draft Generation** - Generate professional email replies instantly
- **Local Storage** - All data stored locally in browser localStorage (no server-side database)
- **Modern UI** - Beautiful, responsive interface built with Next.js 16, React 19, Tailwind CSS, and shadcn/ui components
- **Vector Search** - Semantic email search using OpenAI embeddings (server-side)
- **Theme Support** - Dark/light/system theme switching

## Project Architecture

### Technology Stack

**Frontend:**
- **Next.js 16** with App Router
- **React 19** with TypeScript
- **Tailwind CSS 4.1.9** for styling
- **shadcn/ui** component library (Radix UI primitives)
- **Local Storage** for client-side data persistence
- **Vercel Analytics** for analytics

**Backend:**
- **Next.js API Routes** (`/app/api/*`) - Main API endpoints
- **Express Server** (`/server/index.ts`) - Separate Express server running on port 3001 for advanced AI features
- **Google APIs** (`googleapis`) - Gmail OAuth and email fetching
- **OpenAI API** - GPT-4o-mini for AI features, text-embedding-3-small for vector embeddings
- **Supabase (pgvector)** - Vector database for semantic email search and embeddings storage

**Key Dependencies:**
- `googleapis@^166.0.0` - Gmail API integration
- `openai@^6.8.1` - OpenAI API client
- `express@^5.1.0` - Express server for advanced routes
- `@supabase/supabase-js@^2.83.0` - Supabase client for vector database
- `next-themes@^0.4.6` - Theme management
- `isomorphic-dompurify@^2.32.0` - HTML sanitization
- `date-fns@4.1.0` - Date utilities
- `zod@3.25.76` - Schema validation

### Project Structure

```
Relay-agent/
├── app/                          # Next.js App Router pages
│   ├── agent/                    # AI Agent page
│   ├── api/                      # Next.js API routes
│   │   ├── ai/
│   │   │   ├── enrich-email/     # Email enrichment (summaries, labels)
│   │   │   └── generate-draft/   # AI draft generation
│   │   ├── auth/
│   │   │   └── gmail/            # Gmail OAuth flow
│   │   │       ├── route.ts      # Start OAuth
│   │   │       └── callback/     # OAuth callback handler
│   │   └── emails/               # Email fetching endpoint
│   ├── archives/                 # Archived emails page
│   ├── drafts/                   # Drafts management page
│   ├── inbox/                    # Main inbox page
│   ├── settings/                 # Settings page
│   ├── thread/[id]/              # Email thread view
│   ├── layout.tsx                 # Root layout with ThemeProvider
│   ├── page.tsx                   # Home page (redirects to /inbox)
│   └── globals.css                # Global styles
│
├── components/                    # React components
│   ├── ui/                        # shadcn/ui components (50+ components)
│   ├── agent-actions.tsx          # AI agent action buttons
│   ├── agent-banner.tsx           # AI agent banner
│   ├── ai-label-badge.tsx         # AI-generated label badges
│   ├── app-sidebar.tsx            # Main navigation sidebar
│   ├── archives-list.tsx          # Archives list component
│   ├── drafts-list.tsx            # Drafts list component
│   ├── inbox-list.tsx             # Inbox email list
│   ├── provider-icon.tsx          # Email provider icons (Gmail/Outlook)
│   ├── search-bar.tsx             # Email search bar
│   ├── settings-content.tsx       # Settings page content
│   ├── theme-provider.tsx         # Theme context provider
│   ├── theme-toggle.tsx           # Theme switcher
│   └── thread-view.tsx            # Email thread viewer
│
├── lib/                           # Utility libraries
│   ├── email-utils.ts             # Email parsing/formatting utilities
│   ├── gmail.ts                   # Gmail API wrapper
│   ├── openai.ts                  # OpenAI API wrapper (client-side)
│   ├── storage.ts                 # LocalStorage abstraction
│   └── utils.ts                   # General utilities (cn, etc.)
│
├── server/                        # Express server (port 3001)
│   ├── index.ts                   # Express app setup
│   ├── lib/
│   │   └── supabase.ts            # Supabase client initialization
│   ├── routes/
│   │   ├── ai.ts                  # AI routes (index, search, summarize, draft, classify)
│   │   ├── auth.ts                # Auth routes
│   │   └── emails.ts              # Email routes
│   ├── services/
│   │   ├── ai.ts                  # AI service (embeddings, vector search)
│   │   └── vector_store.ts        # Vector store implementation (Supabase/pgvector)
│   └── test-ai.ts                 # AI testing utilities
│
├── types/                         # TypeScript type definitions
│   ├── index.ts                   # Core types (Email, EmailAccount, Draft, etc.)
│   └── isomorphic-dompurify.d.ts  # Type definitions
│
├── hooks/                         # React hooks
│   ├── use-mobile.ts              # Mobile detection hook
│   └── use-toast.ts               # Toast notification hook
│
├── public/                        # Static assets
│   └── [various images and icons]
│
├── styles/                        # Additional styles
│   └── globals.css
│
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript config (Next.js)
├── tsconfig.server.json           # TypeScript config (Express server)
├── next.config.mjs                # Next.js configuration
├── postcss.config.mjs             # PostCSS configuration
├── components.json                # shadcn/ui configuration
└── SETUP.md                       # Setup documentation
```

## Key Components and Data Flow

### Data Types (`types/index.ts`)

**EmailAccount:**
- Stores OAuth tokens (accessToken, refreshToken, expiryDate)
- Provider type (gmail/outlook)
- Connection metadata

**Email:**
- Full email data with parsed headers
- Separate `body` (HTML) and `bodyPlain` (text)
- AI enrichments: `aiSummary`, `aiLabels`
- Attachment metadata
- Thread information

**Draft:**
- Email drafts with AI generation flag
- Thread association for replies

**LocalStorageData:**
- Centralized storage structure
- Contains: accounts, emails, drafts, settings, paginationTokens

### Core Libraries

**`lib/gmail.ts` - Gmail API Integration:**
- `getAuthUrl()` - Generate OAuth authorization URL
- `getTokens(code)` - Exchange authorization code for tokens
- `fetchEmails(accessToken, maxResults, pageToken)` - Fetch emails with pagination
- `parseGmailMessage(message)` - Parse Gmail API response to Email type
- `sendEmail()` - Send email via Gmail API
- Handles multipart email parsing (HTML/plain text)
- Extracts attachment metadata

**`lib/openai.ts` - OpenAI Client Utilities:**
- `generateDraft(apiKey, emailContext, userInstructions)` - Generate email reply drafts
- `generateSummary(apiKey, email)` - Generate email summaries
- `generateLabels(apiKey, email)` - Generate smart labels
- `generateActions(apiKey, email)` - Generate suggested action items
- Uses GPT-4o-mini model for all operations

**`lib/api.ts` - Express Server API Client:**
- `api.ai.searchEmails(query, limit)` - Semantic email search via Express server
- `api.ai.summarizeThread(emails)` - Summarize email threads via Express server
- `api.ai.draftReply(email, context)` - Draft replies with context via Express server
- `api.ai.classifyEmail(email)` - Classify emails via Express server
- `api.ai.indexEmails(emails)` - Index emails for vector search
- Connects to Express server at `http://localhost:3001/api` (configurable via `NEXT_PUBLIC_API_URL`)

**`lib/storage.ts` - LocalStorage Management:**
- Centralized localStorage abstraction
- Methods for accounts, emails, drafts, settings
- Pagination token management
- Automatic initialization with defaults
- Duplicate prevention for emails

**`server/services/ai.ts` - Server-Side AI Service:**
- `generateEmbedding(text)` - Generate vector embeddings using OpenAI
- `indexEmail(email)` - Index email for vector search (stores in Supabase)
- `searchEmails(query, limit)` - Semantic email search using Supabase pgvector
- `summarizeThread(emails)` - Summarize email threads
- `draftReply(email, context)` - Draft replies with context
- `classifyEmail(email)` - Classify emails into categories

**`server/services/vector_store.ts` - Vector Store (Supabase/pgvector):**
- `saveEmbedding(id, embedding, metadata, text)` - Save embeddings to Supabase
- `findSimilar(queryVector, limit)` - Find similar emails using `match_embeddings` RPC function
- `getRecord(id)` - Retrieve embedding record by ID
- Uses Supabase `embeddings` table with pgvector extension

**`server/lib/supabase.ts` - Supabase Client:**
- Initializes Supabase client with service role key
- Required environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### API Routes

**Next.js API Routes (`/app/api/*`):**

1. **`/api/auth/gmail` (GET)** - Start Gmail OAuth flow
   - Returns authorization URL

2. **`/api/auth/gmail/callback` (GET)** - Handle OAuth callback
   - Exchanges code for tokens
   - Stores account in localStorage

3. **`/api/emails` (POST)** - Fetch emails from Gmail
   - Requires: `accessToken`, optional `maxResults`, `pageToken`
   - Returns: `emails[]`, `nextPageToken`
   - Error handling for expired tokens, disabled API

4. **`/api/ai/generate-draft` (POST)** - Generate email draft
   - Requires: `apiKey`, `email`, optional `instructions`
   - Returns: `draft` (string)

5. **`/api/ai/enrich-email` (POST)** - Enrich email with AI
   - Generates summary and labels
   - Updates email in localStorage

**Express Server Routes (`/server/routes/*`):**

1. **`/api/ai/index` (POST)** - Index emails for vector search
2. **`/api/ai/search` (POST)** - Semantic email search ✅ **Frontend Integrated**
   - Used by `InboxList` component via `api.ai.searchEmails()`
   - Returns relevant emails based on semantic query (not just keywords)
3. **`/api/ai/summarize` (POST)** - Summarize email thread ✅ **Frontend Integrated**
   - Used by `ThreadView` component via `api.ai.summarizeThread()`
   - Triggered by "Summarize" button in thread header
4. **`/api/ai/draft` (POST)** - Draft reply with context ✅ **Frontend Integrated**
   - Used by `ThreadView` component via `api.ai.draftReply()`
5. **`/api/ai/classify` (POST)** - Classify email category ✅ **Frontend Integrated**
   - Used automatically during email enrichment

### UI Components

**Main Pages:**
- `/inbox` - Unified inbox with email list
- `/drafts` - Saved email drafts
- `/archives` - Archived emails
- `/agent` - AI agent interface
- `/settings` - Settings and account management
- `/thread/[id]` - Individual email thread view

**Key Components:**
- `AppSidebar` - Navigation sidebar with theme toggle
- `InboxList` - Email list with sync functionality and AI semantic search
- `ThreadView` - Email thread viewer with AI features (summarize, draft generation)
- `SearchBar` - AI-powered semantic email search interface
- `SettingsContent` - Settings management (OAuth, API keys, preferences)
- `ThemeProvider` - Theme context (dark/light/system)
- `api` (lib/api.ts) - API client for Express server AI endpoints

### Development Workflow

**Scripts:**
- `pnpm dev` - Runs Next.js dev server + Express server concurrently
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

**Environment Variables (`.env.local`):**
- `GOOGLE_CLIENT_ID` - Gmail OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Gmail OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI
- `NEXT_PUBLIC_APP_URL` - Application URL
- `SESSION_SECRET` - Session secret
- `OPENAI_API_KEY` - OpenAI API key (optional, can be set in UI, required for AI features)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (required for vector store)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required for vector store)
- `NEXT_PUBLIC_API_URL` - Express server URL (defaults to `http://localhost:3001/api`)

## Key Challenges and Analysis

### Current Architecture Decisions

1. **Dual Server Setup:**
   - Next.js API routes for basic operations
   - Express server for advanced AI features (vector search, embeddings)
   - Both run concurrently in development

2. **Client-Side Storage:**
   - All data stored in browser localStorage
   - No server-side database
   - OAuth tokens stored client-side (security consideration)
   - Pagination tokens managed per account

3. **Email Parsing:**
   - Handles multipart emails (HTML/plain text)
   - Recursive part extraction for nested multipart messages
   - Attachment metadata extraction
   - Base64 decoding for email bodies

4. **AI Integration:**
   - **Dual AI Architecture:**
     - Next.js API routes for basic features (email enrichment, simple draft generation)
     - Express server for advanced features (vector search, thread summarization, context-aware drafts)
   - Client-side OpenAI calls via Next.js API routes
   - Server-side vector embeddings via Express server
   - GPT-4o-mini for cost efficiency
   - text-embedding-3-small for embeddings
   - **Supabase (pgvector)** for persistent vector storage and similarity search
   - Uses `match_embeddings` RPC function for efficient cosine similarity search
   - **Frontend Integration:** `lib/api.ts` provides unified API client for Express server endpoints

### Known Limitations

1. **Token Management:**
   - No automatic token refresh implemented
   - Tokens stored in localStorage (not encrypted)
   - Expired tokens require manual reconnection

2. **Email Sync:**
   - Manual sync required (no automatic polling)
   - Limited to 50 emails per sync by default
   - No real-time updates

3. **Vector Store:**
   - ✅ **UPDATED**: Now uses Supabase (pgvector) for persistent vector storage
   - Requires Supabase setup with `embeddings` table and `match_embeddings` RPC function
   - Environment variables required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

4. **Error Handling:**
   - Basic error handling in API routes
   - Some error messages could be more user-friendly

## High-level Task Breakdown

### Landing Page Implementation (Inspiration: /design pictures)

**Goal:** Replace the current home page redirect with a beautiful, modern landing page inspired by the Æther design language.

#### Phase 1: Hero & Navigation
**Task 1.1: Create Landing Page Shell & Navigation**
- [ ] Implement a clean, minimalist navbar with logo, links (How it works, Features, Pricing), and action buttons (Sign in, Get early access)
- [ ] Set up the dark theme foundation with a deep black/charcoal background and subtle radial gradients
- Success Criteria: Navbar is responsive and matches the aesthetic of image-1.png

**Task 1.2: Implement Hero Section**
- [ ] Add the "NOW IN PRIVATE BETA" pill badge
- [ ] Implement the main headline: "Email without the **inbox.**" with the highlight color
- [ ] Add subheadline and CTA buttons (Request access, Watch demo)
- [ ] Add the bottom stats row (Saved daily, Accuracy, Inbox anxiety)
- Success Criteria: Hero section visually matches image-1.png with correct spacing and typography

#### Phase 2: Interactive Showcase
**Task 2.1: Implement Agent Conversation Section**
- [ ] Create a "Talk to your agent. Not your inbox." section header
- [ ] Build the interactive chat interface window showing the agent's summary of emails
- [ ] Implement the "Conversation / Daily Digest / Pending Actions" tab switcher
- Success Criteria: Interactive section looks and feels like image-2.png

#### Phase 3: Features & Trust
**Task 3.1: Implement Feature Grid**
- [ ] Create the "Built for the post-inbox era" section
- [ ] Implement the 3x2 grid of feature cards (Zero inbox interface, Autonomous actions, Privacy-first, etc.)
- [ ] Use consistent iconography and glassmorphism effects for cards
- Success Criteria: Feature grid matches image-3.png

**Task 3.2: Footer & Final Polish**
- [ ] Implement the "Join the waitlist" CTA card
- [ ] Add the minimalist footer with legal links and social icons
- [ ] Add smooth scroll animations and hover effects throughout
- Success Criteria: Complete landing page is functional and polished

---

### Relayed Mode - AI-Powered Conversational Email Interface

**Goal:** Implement a "Relayed Mode" toggle that transforms the email experience from a traditional inbox view to an intelligent agent-based conversational interface.

---

#### Phase 1: Core Infrastructure & Mode Toggle
**Task 1.1: Create Mode Toggle & Storage** ⬅️ CURRENT
- [ ] Add `relayedMode: boolean` to AppSettings in types
- [ ] Add mode toggle in storage.ts  
- [ ] Create RelayedModeToggle component for sidebar
- [ ] Store mode preference persistently
- Success Criteria: Toggle switch visible in sidebar, mode persists on refresh

**Task 1.2: Create Relayed Mode Layout Shell**
- [ ] Create `components/relayed/relayed-hub.tsx` - Main container
- [ ] Create `components/relayed/command-input.tsx` - Natural language input
- [ ] Conditionally render RelayedHub or traditional InboxList based on mode
- [ ] Basic dark theme with gradient background
- Success Criteria: Switching mode shows different UI

---

#### Phase 2: Intent-Based Organization
**Task 2.1: Email Intent Classification**
- [ ] Add `intent` field to Email type (decisions, info_request, meeting, action_item, update, relationship)
- [ ] Create `/api/ai/classify-intent` endpoint to classify emails
- [ ] Add AI prompt for intent detection
- Success Criteria: Emails have intent classifications

**Task 2.2: Intent Cards UI**
- [ ] Create `components/relayed/intent-card.tsx` - Card showing intent category
- [ ] Create `components/relayed/intent-grid.tsx` - Grid layout for all intent categories
- [ ] Show count badges and preview of top items per category
- [ ] Add expand/collapse functionality
- Success Criteria: User sees emails grouped by intent with counts

---

#### Phase 3: Central Command Hub (Conversational AI)
**Task 3.1: Command Processing**
- [ ] Create `components/relayed/command-processor.tsx` - Handles natural language commands
- [ ] Integrate with existing AI search/summarize APIs
- [ ] Support commands: "What needs my attention?", "Schedule meeting with X", "Draft response to Y"
- Success Criteria: User can ask questions and get AI responses

**Task 3.2: Response Rendering**
- [ ] Create `components/relayed/ai-response.tsx` - Renders AI responses beautifully
- [ ] Support different response types: summary cards, email lists, action confirmations
- [ ] Add typing animation for responses
- Success Criteria: AI responses render with nice animations

---

#### Phase 4: Smart Prioritization
**Task 4.1: Priority Feed Component**
- [ ] Create `components/relayed/priority-feed.tsx` - Dynamic priority list
- [ ] Use existing priorityScore, sentiment, urgency data
- [ ] Show urgency signals, relationship importance, project context
- Success Criteria: Priority feed shows most important items first

**Task 4.2: VIP & Relationship Tracking**
- [ ] Add `vipSenders: string[]` to settings for important contacts
- [ ] Create relationship attention indicators (haven't replied in a while)
- [ ] Add visual badges for VIP senders
- Success Criteria: VIP emails highlighted, relationship warnings shown

---

#### Phase 5: Ambient Awareness Indicators
**Task 5.1: Ambient Indicators Component**
- [ ] Create `components/relayed/ambient-indicators.tsx`
- [ ] Show: relationships needing attention, conversations moving without input
- [ ] Show: emerging patterns (sudden volume from person/topic)
- [ ] Show: sentiment shifts in ongoing discussions
- Success Criteria: Subtle indicators visible in hub

---

#### Phase 6: Visual Design Polish
**Task 6.1: Relayed Mode Theme**
- [ ] Create CSS variables for relayed mode specific colors
- [ ] Add soft gradients and glow effects
- [ ] Implement card hover/expand animations
- [ ] Add timeline view styling
- Success Criteria: Beautiful, minimalist, distinctive design

---

### AI Agent Actions Implementation Plan

**Goal:** Implement all AI agent actions listed in the `/agent` page as functional features with database persistence, usage tracking, and configuration options.

#### Credit Optimization Strategy
To minimize AI LLM costs, we will:
1. **Cache AI results** - Store summaries, classifications, sentiment analysis in localStorage/Supabase to avoid re-processing
2. **Batch processing** - Process multiple emails in single API calls where possible
3. **Tiered processing** - Use cheaper models for simple tasks (classification), reserve GPT-4o-mini for complex tasks (drafting)
4. **Smart triggers** - Only process on user action or configurable rules, not automatically for every email
5. **Token optimization** - Truncate long emails, use efficient prompts, set appropriate max_tokens

---

### Phase 1: Core Infrastructure (Database & Types)
**Task 1.1: Extend Types for Agent Actions**
- [ ] Add new types: `Task`, `Reminder`, `Filter`, `AgentUsageStats`, `SentimentResult`, `MeetingRequest`
- [ ] Extend `Email` type with: `sentiment`, `priority`, `extractedTasks`, `meetingRequests`
- [ ] Add agent settings to `AppSettings`
- Success Criteria: Types compile without errors

**Task 1.2: Create Agent Data Storage**
- [ ] Add agent-related storage methods to `lib/storage.ts`
- [ ] Create tables/collections for: tasks, reminders, filters, usage_stats
- [ ] Implement usage tracking (count operations, estimate time saved)
- Success Criteria: Can store and retrieve agent data

---

### Phase 2: Email Management Features

**Task 2.1: Smart Reply Suggestions**
- [ ] Create `/api/ai/suggest-replies` endpoint
- [ ] Generate 3 contextual reply options (short, medium, detailed)
- [ ] Cache suggestions per email to avoid re-generation
- [ ] Add UI component to show suggestions in ThreadView
- Success Criteria: User sees 3 reply options for any email

**Task 2.2: Auto-Categorization**
- [ ] Extend existing classification to support custom categories
- [ ] Add category management in settings
- [ ] Create auto-categorization rules engine
- [ ] Process emails on sync (configurable)
- Success Criteria: Emails auto-categorize into custom folders

**Task 2.3: Priority Inbox**
- [ ] Create priority scoring algorithm (AI + rules-based hybrid)
- [ ] Score factors: sender importance, keywords, sentiment, labels
- [ ] Add priority sort option to inbox
- [ ] Store priority scores in email metadata
- Success Criteria: Inbox can sort by AI-determined priority

---

### Phase 3: Productivity Features

**Task 3.1: Task Extraction**
- [ ] Create `/api/ai/extract-tasks` endpoint
- [ ] Extract action items with deadlines from email content
- [ ] Add task storage and management UI
- [ ] Link tasks back to source emails
- Success Criteria: View extracted tasks from emails

**Task 3.2: Follow-up Reminders**
- [ ] Create reminder data model and storage
- [ ] Detect emails needing follow-up (sent emails without reply, flagged items)
- [ ] Add reminder UI component
- [ ] Implement notification system (in-app)
- Success Criteria: User can set/view/manage reminders

**Task 3.3: Meeting Scheduler (Beta)**
- [ ] Detect meeting requests in emails using AI
- [ ] Extract proposed times and participants
- [ ] Generate calendar event suggestions
- [ ] Add meeting detection UI badge
- Success Criteria: Detect and display meeting requests

---

### Phase 4: Content Analysis Features

**Task 4.1: Enhanced Email Summarization** (already partially exists)
- [ ] Add caching for generated summaries
- [ ] Track summarization usage stats
- [ ] Allow regeneration with different tones/lengths
- Success Criteria: Summaries persist and track usage

**Task 4.2: Sentiment Analysis**
- [ ] Create `/api/ai/analyze-sentiment` endpoint
- [ ] Detect: positive/negative/neutral + urgency level
- [ ] Add visual indicators in inbox (emoji or color)
- [ ] Store sentiment in email metadata
- Success Criteria: Emails display sentiment indicators

---

### Phase 5: Automation Features

**Task 5.1: Smart Filters**
- [ ] Create natural language filter parser
- [ ] Convert NL to filter rules (from, subject, contains, etc.)
- [ ] Store filters in settings
- [ ] Apply filters on email sync
- Success Criteria: Create filters using natural language

**Task 5.2: Auto-Archive**
- [ ] Create archive rules engine
- [ ] Support rules: by age, by sender, by label, by read status
- [ ] Add archive rules management UI
- [ ] Execute archive on schedule or manual trigger
- Success Criteria: Emails auto-archive based on rules

**Task 5.3: Bulk Actions**
- [ ] Create bulk action selection UI
- [ ] Support actions: archive, delete, label, mark read/unread
- [ ] Add AI-powered selection suggestions
- [ ] Track bulk action usage
- Success Criteria: Perform actions on multiple emails at once

---

### Phase 6: Analytics & Configuration

**Task 6.1: Usage Analytics Dashboard**
- [ ] Create analytics data collection
- [ ] Calculate time saved estimates
- [ ] Build analytics UI with charts
- [ ] Show per-feature usage stats
- Success Criteria: View detailed usage analytics

**Task 6.2: Agent Configuration Panel**
- [ ] Create per-feature toggle switches
- [ ] Add sensitivity/threshold settings
- [ ] Implement custom category management
- [ ] Add API key management improvements
- Success Criteria: Configure all agent features from settings

## Project Status Board

### Current Status / Progress Tracking

**Project State:** Active development - Landing Page Implementation

**Recent Work:**
- Project structure established
- Gmail OAuth integration complete
- AI features implemented (summaries, labels, drafts)
- Local storage system in place
- UI components built with shadcn/ui
- Theme system implemented
- **Vector store migrated from file-based to Supabase (pgvector)** ✅
- **Supabase integration complete for persistent vector storage** ✅
- **Frontend AI integration complete** ✅
- **Relayed Mode Implementation - COMPLETE** ✅
- **AI Agent Actions Implementation - COMPLETE** ✅

**Current Sprint: Landing Page Implementation**

- [x] **Task 1.1: Create Landing Page Shell & Navigation** ✅
- [x] **Task 1.2: Implement Hero Section** ✅
- [x] **Task 2.1: Implement Agent Conversation Section** ✅
- [x] **Task 3.1: Implement Feature Grid** ✅
- [x] **Task 3.2: Footer & Final Polish** ✅

- [x] **Task 1.1: Create Mode Toggle & Storage** ✅
  - Added `relayedMode: boolean` and `EmailIntent` type to types/index.ts
  - Added `vipSenders` to agentConfig for VIP contact tracking
  - Added intent, lastInteraction, requiresResponse fields to Email type
  - Added 15+ new methods to storage.ts for relayed mode functionality
  - Created RelayedModeToggle component with animated toggle switch
  
- [x] **Task 1.2: Create Relayed Mode Layout Shell** ✅
  - Created `components/relayed/relayed-hub.tsx` - Main container
  - Created `components/relayed/command-input.tsx` - Natural language input
  - Updated inbox page to conditionally render RelayedHub vs InboxList

- [x] **Task 2.1: Email Intent Classification** ✅
  - Added `EmailIntent` type with 7 intent categories
  - Created `/api/ai/classify-intent` endpoint (POST for single, PUT for batch)
  - Added `classifyIntent` and `batchClassifyIntents` methods to lib/api.ts

- [x] **Task 2.2: Intent Cards UI** ✅
  - Created `components/relayed/intent-grid.tsx` - Grid of intent cards
  - 6 intent categories with color-coded icons
  - Expandable cards showing email previews

- [x] **Task 3.1: Command Processing** ✅
  - Natural language command handler in RelayedHub
  - Supports: "What needs my attention?", "Summarize my inbox", "Find emails about X", etc.
  - Integrates with existing AI search API

- [x] **Task 3.2: Response Rendering** ✅
  - Chat-style message rendering with user/AI messages
  - Timestamps, loading states, smooth animations
  - Quick suggestion buttons for common commands

- [x] **Task 4.1: Priority Feed Component** ✅
  - Created `components/relayed/priority-feed.tsx`
  - Filter tabs: All, Urgent, VIP, Unread, Meetings
  - Dynamic priority calculation based on score, sentiment, VIP status
  - Email cards with priority badges and sentiment indicators

- [x] **Task 5.1: Ambient Indicators Component** ✅
  - Created `components/relayed/ambient-indicators.tsx`
  - Shows: VIP follow-up needed, unusual activity patterns
  - Sentiment alerts, pending responses, unread VIP messages
  - Dismissible indicator badges

- [x] **Task 6.1: Visual Design Polish** ✅
  - Gradient backgrounds, glow effects on toggle
  - Card hover animations, smooth transitions
  - Custom scrollbar styling, glass effects
  - Dark theme optimized design

- [x] **Phase 1: Core Infrastructure** ✅
  - [x] Task 1.1: Extend Types for Agent Actions (ExtractedTask, Reminder, SmartFilter, ArchiveRule, AgentUsageStats, etc.)
  - [x] Task 1.2: Create Agent Data Storage (tasks, reminders, filters, usage tracking methods)
- [x] **Phase 2: Email Management** ✅
  - [x] Task 2.1: Smart Reply Suggestions (with caching to avoid re-generation)
  - [x] Task 2.2: Auto-Categorization (with custom categories support)
  - [x] Task 2.3: Priority Inbox (0-100 scoring algorithm)
- [x] **Phase 3: Productivity** ✅
  - [x] Task 3.1: Task Extraction (extract action items with deadlines)
  - [x] Task 3.2: Follow-up Reminders (reminder system with snooze)
  - [x] Task 3.3: Meeting Scheduler (detect meeting requests, times, participants)
- [x] **Phase 4: Content Analysis** ✅
  - [x] Task 4.1: Enhanced Email Summarization (already existed, now with caching)
  - [x] Task 4.2: Sentiment Analysis (positive/negative/neutral + urgency levels)
- [x] **Phase 5: Automation** ✅
  - [x] Task 5.1: Smart Filters (natural language to filter rules)
  - [x] Task 5.2: Auto-Archive (rules engine with age, sender, label criteria)
  - [x] Task 5.3: Bulk Actions (archive, mark read/unread, label operations)
- [x] **Phase 6: Analytics & Configuration** ✅
  - [x] Task 6.1: Usage Analytics Dashboard (processed count, time saved estimates)
  - [x] Task 6.2: Agent Configuration Panel (feature toggles, thresholds)

**CRITICAL FIX IMPLEMENTED:**
- Fixed re-summarization bug: Emails now check if already enriched before calling AI APIs
- Saves AI tokens by caching: Reply suggestions, classifications, summaries

**Known Issues:**
- Token refresh not implemented
- No automatic email sync
- Email sending functionality incomplete
- ~~Vector store persistence unclear~~ ✅ **RESOLVED**: Now using Supabase (pgvector)

### Executor's Feedback or Assistance Requests

**Relayed Mode - Phase 1 Implementation Complete!** 🎉

All core Relayed Mode features have been implemented:

**New Files Created:**
- `components/relayed-mode-toggle.tsx` - Mode toggle switch component
- `components/relayed/relayed-hub.tsx` - Main Relayed Mode container
- `components/relayed/command-input.tsx` - Natural language command input
- `components/relayed/intent-grid.tsx` - Intent-based email organization
- `components/relayed/priority-feed.tsx` - Priority-sorted email feed
- `components/relayed/ambient-indicators.tsx` - Relationship/pattern awareness
- `components/relayed/index.ts` - Component exports
- `app/api/ai/classify-intent/route.ts` - Intent classification API endpoint

**Files Modified:**
- `types/index.ts` - Added EmailIntent type, relayedMode setting, VIP senders
- `lib/storage.ts` - Added 15+ methods for relayed mode functionality
- `lib/api.ts` - Added intent classification and command processing methods
- `app/inbox/page.tsx` - Made client component, conditional rendering
- `app/globals.css` - Added animations, scrollbar styling, glass effects
- `components/app-sidebar.tsx` - Added RelayedModeToggle to sidebar

**Features Working:**
✅ Mode toggle (Normal ↔ Relayed) persists across page reloads
✅ Command Hub with natural language input and AI responses
✅ Quick suggestion buttons for common commands
✅ By Intent view showing email organization by intent type
✅ Priority Feed with filter tabs (All, Urgent, VIP, Unread, Meetings)
✅ Ambient indicators showing relationship attention needs
✅ Visual design with gradients, glow effects, animations

**Next Steps (Optional Enhancements):**
- Auto-classify emails on sync (batch classification)
- Voice input integration
- More command types (draft response, schedule meeting)
- Deeper AI integration for autonomous actions

---

**Previous Implementation Complete!** All AI Agent Actions have been implemented:

**Backend Changes:**
- `types/index.ts`: Added 10+ new types (ExtractedTask, Reminder, SmartFilter, ArchiveRule, SentimentResult, MeetingRequest, AgentUsageStats, ReplySuggestion, CustomCategory, FilterRule, FilterAction)
- `lib/storage.ts`: Added 30+ new methods for tasks, reminders, filters, archive rules, bulk operations, and usage tracking
- `lib/api.ts`: Added 8 new API client methods for all AI features
- `server/services/ai.ts`: Added 7 new AI service functions (generateReplySuggestions, analyzeSentiment, calculatePriority, extractTasks, detectMeetingRequest, parseFilterFromNaturalLanguage, suggestArchiveCandidates, batchEnrichEmails)
- `server/routes/ai.ts`: Added 8 new API endpoints

**Frontend Changes:**
- `components/agent-actions.tsx`: Complete rewrite with tabs (Overview, Tasks, Filters, Settings), action cards with run buttons, task management, filter creation dialog, usage statistics dashboard
- `components/inbox-list.tsx`: Added sentiment/urgency/priority/meeting indicators in email list
- `components/thread-view.tsx`: Added smart reply suggestions panel, task extraction, sentiment display, meeting detection, archive button

**Critical Bug Fix:**
- Fixed the re-summarization issue! Now emails check `existingEmail?.aiLabels` before calling AI APIs, preventing duplicate token usage on server restart.

**Token Optimization Implemented:**
- Text truncation (2000 chars default) to reduce prompt sizes
- Reply suggestion caching in localStorage
- Batch email enrichment API for processing multiple emails in one call
- max_tokens limits on all AI calls

## Lessons

### Technical Notes

1. **Email Parsing:**
   - Gmail API returns multipart emails that require recursive parsing
   - HTML and plain text parts are separate and must be extracted correctly
   - Base64 encoding is used for email body content

2. **OAuth Flow:**
   - Gmail OAuth requires specific scopes for read/send/compose
   - Tokens must be stored securely (currently in localStorage)
   - Redirect URI must match exactly in Google Cloud Console

3. **AI Integration:**
   - GPT-4o-mini is used for cost efficiency
   - Separate embeddings model (text-embedding-3-small) for vector search
   - API keys can be set in UI or environment variables
   - **Vector storage**: Supabase (pgvector) provides persistent, scalable vector storage
   - Uses `match_embeddings` RPC function for efficient similarity search with configurable threshold

4. **Storage:**
   - localStorage has size limits (~5-10MB)
   - All data is stored as JSON string
   - Pagination tokens stored per account for incremental sync

5. **Development:**
   - Uses `concurrently` to run Next.js and Express server together
   - TypeScript configured separately for Next.js and Express
   - shadcn/ui components are highly customizable

### User Specified Lessons

- Include info useful for debugging in the program output
- Read the file before you try to edit it
- If there are vulnerabilities that appear in the terminal, run npm audit before proceeding
- Always ask before using the -force git command

## Additional Context for AI IDE

### Quick Reference

**To understand email flow:**
1. User connects Gmail via OAuth (`/api/auth/gmail`)
2. Emails fetched via `/api/emails` using access token
3. Emails parsed by `lib/gmail.ts::parseGmailMessage()`
4. Emails stored in localStorage via `lib/storage.ts`
5. AI enrichment via `/api/ai/enrich-email` (optional)
6. Emails displayed in `components/inbox-list.tsx`

**To understand AI features:**
1. OpenAI API key stored in settings (localStorage or env)
2. **Dual AI Architecture:**
   - **Next.js API routes** (`/app/api/ai/*`) - Used for basic AI features (enrich-email, generate-draft)
   - **Express server** (`/server/routes/ai.ts`) - Used for advanced AI features (vector search, thread summarization)
3. **Frontend Integration:**
   - `lib/api.ts` provides API client for Express server endpoints
   - `InboxList` uses `api.ai.searchEmails()` for semantic search
   - `ThreadView` uses `api.ai.summarizeThread()` for thread summarization
   - `ThreadView` uses `api.ai.draftReply()` for context-aware drafts
4. AI service in `server/services/ai.ts` handles embeddings and search
5. Vector store in `server/services/vector_store.ts` uses Supabase (pgvector) for persistent storage
6. Supabase client initialized in `server/lib/supabase.ts`
7. **Express server must be running** (port 3001) for vector search and thread summarization to work

**To understand storage:**
- All data in `localStorage` under key `'relay_email_data'`
- Structure defined in `types/index.ts::LocalStorageData`
- Managed via `lib/storage.ts` with helper methods

**To understand UI:**
- Uses shadcn/ui components (50+ components in `components/ui/`)
- Theme managed by `components/theme-provider.tsx`
- Navigation in `components/app-sidebar.tsx`
- Main pages in `app/*/page.tsx`

### Common Tasks

**Adding a new email provider:**
1. Add provider type to `types/index.ts::EmailAccount`
2. Create provider library similar to `lib/gmail.ts`
3. Add OAuth routes in `app/api/auth/[provider]/`
4. Update `components/provider-icon.tsx` for icon
5. Update `components/app-sidebar.tsx` for navigation

**Adding a new AI feature:**
1. Add function to `lib/openai.ts` (client-side) or `server/services/ai.ts` (server-side)
2. Create API route in `app/api/ai/[feature]/route.ts` or `server/routes/ai.ts`
3. If using Express server, add method to `lib/api.ts` API client
4. Add UI component to call the API
5. Update settings if feature needs toggling

**Frontend AI Features Currently Available:**
1. **Smart Semantic Search** - Type natural language queries in inbox search bar
2. **Thread Summarization** - Click Sparkles icon in thread header to generate summary
3. **AI Draft Generation** - Auto-generates or manually regenerate drafts with custom instructions
4. **Email Classification** - Automatic labels (urgent, action, work, personal, etc.) on sync
5. **Email Summaries** - Auto-generated summaries displayed in thread view

**Modifying email display:**
1. Check `components/inbox-list.tsx` for list view
2. Check `components/thread-view.tsx` for thread view
3. Email data structure in `types/index.ts::Email`
4. Email utilities in `lib/email-utils.ts`

---

*Last Updated: [Current Date]*
*This document serves as a comprehensive reference for AI IDE context and project understanding.*


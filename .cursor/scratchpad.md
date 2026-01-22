# Relay Email Agent - Context (Concise)

Purpose
- AI-powered email client for Gmail (Outlook planned) with smart summaries, labels, drafts, and semantic search.

Architecture
- Next.js App Router frontend + API routes (`app/api/*`) for basic operations.
- Express server (`server/index.ts`, port 3001) for advanced AI features (embeddings, semantic search, thread summarization).
- Storage: client-side localStorage for app data; Supabase (pgvector) for embeddings.

Key flows
- OAuth: `app/api/auth/gmail/*` -> tokens stored in localStorage.
- Email sync: `app/api/emails` -> parse in `lib/gmail.ts` -> store via `lib/storage.ts`.
- AI enrichment: Next.js routes for summaries/labels/drafts; Express routes for search/summarize/draft/classify.

AI endpoints (Express)
- POST `/api/ai/index` (index email embeddings)
- POST `/api/ai/search` (semantic search)
- POST `/api/ai/summarize` (thread summary)
- POST `/api/ai/draft` (context-aware draft)
- POST `/api/ai/classify` (email category)

Key files
- `lib/gmail.ts` email parsing and Gmail API wrapper
- `lib/storage.ts` localStorage abstraction
- `lib/api.ts` client for Express AI endpoints
- `server/services/ai.ts` embeddings + LLM features
- `server/services/vector_store.ts` Supabase pgvector operations

Commands
- `pnpm dev` (Next.js + Express)
- `pnpm build`
- `pnpm lint`

Env vars (core)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`, `SESSION_SECRET`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`)

Known limitations
- No token refresh
- Manual email sync
